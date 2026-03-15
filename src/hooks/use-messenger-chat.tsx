/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useGateway } from "@/hooks/use-gateway";
import type { EventFrame, GatewayClient } from "@/lib/gateway-client";
import {
  buildAssistantTextMessage,
  buildOptimisticUserMessage,
  extractText,
  isAssistantSilentReplyMessage,
  normalizePendingAttachments,
  parseRawMessage,
  parseRawMessages,
  serializeAttachments,
  type ChatMessage,
  type PendingImageAttachment,
  type QueuedChatMessage,
  type RawMessage,
  type SendOutcome,
} from "@/hooks/use-chat";
import {
  markSessionPending,
  clearSessionPending,
} from "@/hooks/use-any-agent-active";

type ChatEventPayload = {
  runId: string;
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
};

type SessionState = {
  messages: ChatMessage[];
  rawMessages: RawMessage[];
  stream: string | null;
  loading: boolean;
  error: string | null;
  queue: QueuedChatMessage[];
  sending: boolean;
  activeRunId: string | null;
  draft: string;
  attachments: PendingImageAttachment[];
  needsRefresh: boolean;
  hasLoaded: boolean;
  streamStartedAt: number | null;
};

type MessengerChatStore = {
  subscribe: (listener: () => void) => () => void;
  getSessionSnapshot: (sessionKey: string) => SessionState;
  setGatewayState: (value: { client: GatewayClient | null; connected: boolean }) => void;
  retainSession: (sessionKey: string) => () => void;
  ensureFresh: (sessionKey: string) => Promise<void>;
  sendMessage: (
    sessionKey: string,
    text: string,
    attachments?: PendingImageAttachment[],
  ) => Promise<SendOutcome>;
  abortRun: (sessionKey: string) => Promise<boolean>;
  setDraft: (sessionKey: string, draft: string) => void;
  addAttachments: (
    sessionKey: string,
    attachments: PendingImageAttachment[],
  ) => void;
  removeAttachment: (sessionKey: string, attachmentId: string) => void;
  clearAttachments: (sessionKey: string) => void;
  handleChatEvent: (payload: ChatEventPayload) => void;
};

const MessengerChatContext = createContext<MessengerChatStore | null>(null);

function createEmptySessionState(): SessionState {
  return {
    messages: [],
    rawMessages: [],
    stream: null,
    loading: false,
    error: null,
    queue: [],
    sending: false,
    activeRunId: null,
    draft: "",
    attachments: [],
    needsRefresh: false,
    hasLoaded: false,
    streamStartedAt: null,
  };
}

function rawMessageToChatMessage(message: RawMessage): ChatMessage | null {
  if (message.role === "toolResult") {
    return null;
  }

  const content = message.blocks
    .filter((block): block is Extract<typeof message.blocks[number], { type: "text" }> => {
      return block.type === "text";
    })
    .map((block) => block.text)
    .join("");

  return {
    role: message.role,
    content,
    timestamp: message.timestamp,
    localId: message.localId,
  };
}

function createMessengerChatStore(): MessengerChatStore {
  const sessions = new Map<string, SessionState>();
  const listeners = new Set<() => void>();
  const visibleCounts = new Map<string, number>();
  let client: GatewayClient | null = null;
  let connected = false;

  const emitChange = () => {
    for (const listener of listeners) listener();
  };

  const ensureSession = (sessionKey: string): SessionState => {
    const existing = sessions.get(sessionKey);
    if (existing) {
      return existing;
    }

    const next = createEmptySessionState();
    sessions.set(sessionKey, next);
    return next;
  };

  const updateSession = (
    sessionKey: string,
    updater: (session: SessionState) => SessionState,
  ) => {
    const current = ensureSession(sessionKey);
    const next = updater(current);
    if (next === current) {
      return;
    }
    sessions.set(sessionKey, next);
    emitChange();
  };

  const clearStreaming = (sessionKey: string) => {
    clearSessionPending(sessionKey);
    updateSession(sessionKey, (session) => ({
      ...session,
      stream: null,
      activeRunId: null,
      streamStartedAt: null,
    }));
  };

  const appendAssistantMessage = (
    sessionKey: string,
    message: unknown,
    fallbackText?: string,
  ) => {
    if (isAssistantSilentReplyMessage(message)) {
      return;
    }

    const parsed = parseRawMessage(message);
    const fallback = fallbackText?.trim() ?? "";
    const nextRaw =
      parsed?.role === "assistant"
        ? {
            ...parsed,
            timestamp: parsed.timestamp || Date.now(),
          }
        : buildAssistantTextMessage(fallback);

    if (!nextRaw) {
      return;
    }

    const nextText = extractText(message) || fallback;
    updateSession(sessionKey, (session) => ({
      ...session,
      rawMessages: [...session.rawMessages, nextRaw],
      messages: [
        ...session.messages,
        {
          role: "assistant",
          content: nextText,
          timestamp: nextRaw.timestamp,
        },
      ],
    }));
  };

  const loadHistory = async (sessionKey: string, force = false) => {
    const session = ensureSession(sessionKey);
    if (!client || !connected) {
      return;
    }
    if (session.loading) {
      return;
    }
    if (!force && session.hasLoaded && !session.needsRefresh) {
      return;
    }

    updateSession(sessionKey, (current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    try {
      const response = await client.request<{ messages?: Array<unknown> }>(
        "chat.history",
        {
          sessionKey,
          limit: 200,
        },
      );

      let shouldFlushQueue = false;
      updateSession(sessionKey, (current) => {
        const parsedRawMessages = parseRawMessages(response.messages ?? []);
        const parsedMessages = parsedRawMessages
          .map(rawMessageToChatMessage)
          .filter((message): message is ChatMessage => message !== null);
        const shouldClearStreaming =
          current.streamStartedAt !== null &&
          parsedRawMessages.some(
            (message) =>
              message.role === "assistant" &&
              message.timestamp >= current.streamStartedAt!,
          );

        shouldFlushQueue = shouldClearStreaming && current.queue.length > 0;

        return {
          ...current,
          messages: parsedMessages,
          rawMessages: parsedRawMessages,
          loading: false,
          error: null,
          hasLoaded: true,
          needsRefresh: false,
          ...(shouldClearStreaming
            ? {
                stream: null,
                activeRunId: null,
                streamStartedAt: null,
              }
            : {}),
        };
      });

      if (shouldFlushQueue) {
        void flushNextQueuedMessage(sessionKey);
      }
    } catch (error) {
      updateSession(sessionKey, (current) => ({
        ...current,
        loading: false,
        error: String(error),
      }));
    }
  };

  const rollbackOptimisticMessage = (sessionKey: string, localId: string) => {
    updateSession(sessionKey, (session) => ({
      ...session,
      rawMessages: session.rawMessages.filter((message) => message.localId !== localId),
      messages: session.messages.filter((message) => message.localId !== localId),
    }));
  };

  const sendImmediate = async (
    sessionKey: string,
    text: string,
    attachments: PendingImageAttachment[],
  ): Promise<SendOutcome> => {
    if (!client || !connected) {
      return "ignored";
    }

    const trimmed = text.trim();
    const normalizedAttachments = normalizePendingAttachments(attachments);
    const serializedAttachments = serializeAttachments(normalizedAttachments);
    if (!trimmed && !serializedAttachments?.length) {
      return "ignored";
    }

    const now = Date.now();
    const localId = crypto.randomUUID();
    const runId = crypto.randomUUID();

    updateSession(sessionKey, (session) => ({
      ...session,
      messages: [
        ...session.messages,
        {
          role: "user",
          content:
            trimmed ||
            `Image${normalizedAttachments.length > 1 ? "s" : ""} (${
              normalizedAttachments.length
            })`,
          timestamp: now,
          localId,
        },
      ],
      rawMessages: [
        ...session.rawMessages,
        buildOptimisticUserMessage(trimmed, normalizedAttachments, now, localId),
      ],
      activeRunId: runId,
      stream: "",
      streamStartedAt: now,
      sending: true,
      error: null,
      needsRefresh: false,
    }));
    markSessionPending(sessionKey);

    try {
      await client.request("chat.send", {
        sessionKey,
        message: trimmed,
        deliver: false,
        idempotencyKey: runId,
        attachments: serializedAttachments,
      });
      return "sent";
    } catch (error) {
      clearStreaming(sessionKey);
      rollbackOptimisticMessage(sessionKey, localId);
      updateSession(sessionKey, (session) => ({
        ...session,
        sending: false,
        error: String(error),
      }));
      return "error";
    } finally {
      updateSession(sessionKey, (session) => ({
        ...session,
        sending: false,
      }));
    }
  };

  const flushNextQueuedMessage = async (sessionKey: string) => {
    const session = ensureSession(sessionKey);
    if (!client || !connected || session.sending || session.activeRunId) {
      return;
    }

    const next = session.queue[0];
    if (!next) {
      return;
    }

    updateSession(sessionKey, (current) => ({
      ...current,
      queue: current.queue.slice(1),
    }));

    const outcome = await sendImmediate(sessionKey, next.text, next.attachments);
    if (outcome !== "sent") {
      updateSession(sessionKey, (current) => ({
        ...current,
        queue: [next, ...current.queue],
      }));
    }
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSessionSnapshot(sessionKey) {
      return ensureSession(sessionKey);
    },

    setGatewayState(value) {
      client = value.client;
      connected = value.connected;
    },

    retainSession(sessionKey) {
      const nextCount = (visibleCounts.get(sessionKey) ?? 0) + 1;
      visibleCounts.set(sessionKey, nextCount);

      return () => {
        const current = visibleCounts.get(sessionKey) ?? 0;
        if (current <= 1) {
          visibleCounts.delete(sessionKey);
          return;
        }
        visibleCounts.set(sessionKey, current - 1);
      };
    },

    async ensureFresh(sessionKey) {
      const session = ensureSession(sessionKey);
      if (!session.hasLoaded || session.needsRefresh) {
        await loadHistory(sessionKey, session.needsRefresh);
      }
    },

    async sendMessage(sessionKey, text, attachments = []) {
      const normalizedAttachments = normalizePendingAttachments(attachments);
      if (!client || !connected) {
        return "ignored";
      }
      if (!text.trim() && normalizedAttachments.length === 0) {
        return "ignored";
      }

      const session = ensureSession(sessionKey);
      if (session.sending || session.activeRunId) {
        updateSession(sessionKey, (current) => ({
          ...current,
          queue: [
            ...current.queue,
            {
              id: crypto.randomUUID(),
              text: text.trim(),
              attachments: normalizedAttachments,
              createdAt: Date.now(),
            },
          ],
        }));
        return "queued";
      }

      return sendImmediate(sessionKey, text, normalizedAttachments);
    },

    async abortRun(sessionKey) {
      const session = ensureSession(sessionKey);
      if (!client || !connected || session.activeRunId === null) {
        return false;
      }

      try {
        await client.request("chat.abort", {
          sessionKey,
          runId: session.activeRunId,
        });
        return true;
      } catch (error) {
        updateSession(sessionKey, (current) => ({
          ...current,
          error: String(error),
        }));
        return false;
      }
    },

    setDraft(sessionKey, draft) {
      updateSession(sessionKey, (session) => ({
        ...session,
        draft,
      }));
    },

    addAttachments(sessionKey, attachments) {
      if (attachments.length === 0) {
        return;
      }
      updateSession(sessionKey, (session) => ({
        ...session,
        attachments: [...session.attachments, ...attachments],
      }));
    },

    removeAttachment(sessionKey, attachmentId) {
      updateSession(sessionKey, (session) => ({
        ...session,
        attachments: session.attachments.filter(
          (attachment) => attachment.id !== attachmentId,
        ),
      }));
    },

    clearAttachments(sessionKey) {
      updateSession(sessionKey, (session) => ({
        ...session,
        attachments: [],
      }));
    },

    handleChatEvent(payload) {
      if (!payload?.sessionKey) {
        return;
      }

      const sessionKey = payload.sessionKey;
      const session = ensureSession(sessionKey);
      const isVisible = (visibleCounts.get(sessionKey) ?? 0) > 0;

      if (!isVisible) {
        updateSession(sessionKey, (current) => ({
          ...current,
          needsRefresh: true,
        }));
        return;
      }

      const knownRunId = session.activeRunId;
      if (knownRunId && payload.runId && payload.runId !== knownRunId) {
        if (payload.state === "final") {
          appendAssistantMessage(sessionKey, payload.message);
          void flushNextQueuedMessage(sessionKey);
        }
        return;
      }

      switch (payload.state) {
        case "delta": {
          clearSessionPending(sessionKey);
          if (!isAssistantSilentReplyMessage(payload.message)) {
            const nextText = extractText(payload.message);
            updateSession(sessionKey, (current) => ({
              ...current,
              streamStartedAt: current.streamStartedAt ?? Date.now(),
              stream:
                typeof nextText === "string" && nextText.length >= (current.stream?.length ?? 0)
                  ? nextText
                  : current.stream,
            }));
          }
          break;
        }
        case "final":
          appendAssistantMessage(sessionKey, payload.message, session.stream ?? undefined);
          clearStreaming(sessionKey);
          void flushNextQueuedMessage(sessionKey);
          break;
        case "aborted":
          appendAssistantMessage(sessionKey, payload.message, session.stream ?? undefined);
          clearStreaming(sessionKey);
          void flushNextQueuedMessage(sessionKey);
          break;
        case "error":
          clearStreaming(sessionKey);
          updateSession(sessionKey, (current) => ({
            ...current,
            error: payload.errorMessage ?? "chat error",
          }));
          void flushNextQueuedMessage(sessionKey);
          break;
      }
    },
  };
}

export function MessengerChatProvider({ children }: { children: ReactNode }) {
  const { client, connected, subscribe } = useGateway();
  const [store] = useState<MessengerChatStore>(() => createMessengerChatStore());

  useEffect(() => {
    store.setGatewayState({ client, connected });
  }, [client, connected, store]);

  useEffect(() => {
    return subscribe((event: EventFrame) => {
      if (event.event !== "chat") {
        return;
      }
      store.handleChatEvent(event.payload as ChatEventPayload);
    });
  }, [store, subscribe]);

  return (
    <MessengerChatContext.Provider value={store}>
      {children}
    </MessengerChatContext.Provider>
  );
}

export function useMessengerChat(sessionKey: string) {
  const store = useContext(MessengerChatContext);
  if (!store) {
    throw new Error("useMessengerChat must be used within MessengerChatProvider");
  }

  const session = useSyncExternalStore(
    store.subscribe,
    () => store.getSessionSnapshot(sessionKey),
    () => store.getSessionSnapshot(sessionKey),
  );

  useEffect(() => {
    return store.retainSession(sessionKey);
  }, [sessionKey, store]);

  useEffect(() => {
    void store.ensureFresh(sessionKey);
  }, [sessionKey, session.hasLoaded, session.needsRefresh, store]);

  const setDraft = useCallback(
    (draft: string) => {
      store.setDraft(sessionKey, draft);
    },
    [sessionKey, store],
  );

  const addAttachments = useCallback(
    (attachments: PendingImageAttachment[]) => {
      store.addAttachments(sessionKey, attachments);
    },
    [sessionKey, store],
  );

  const removeAttachment = useCallback(
    (attachmentId: string) => {
      store.removeAttachment(sessionKey, attachmentId);
    },
    [sessionKey, store],
  );

  const clearAttachments = useCallback(() => {
    store.clearAttachments(sessionKey);
  }, [sessionKey, store]);

  const sendMessage = useCallback(
    (text: string, attachments: PendingImageAttachment[] = []) =>
      store.sendMessage(sessionKey, text, attachments),
    [sessionKey, store],
  );

  const abortRun = useCallback(
    () => store.abortRun(sessionKey),
    [sessionKey, store],
  );

  return {
    messages: session.messages,
    rawMessages: session.rawMessages,
    stream: session.stream,
    isBusy: session.sending || session.activeRunId !== null,
    isStreaming: session.stream !== null,
    loading: session.loading,
    error: session.error,
    sendMessage,
    queue: session.queue,
    canAbort: session.activeRunId !== null,
    abortRun,
    removeQueuedMessage: () => {
      // Messenger does not expose queued item controls yet.
    },
    draft: session.draft,
    setDraft,
    attachments: session.attachments,
    addAttachments,
    removeAttachment,
    clearAttachments,
  };
}
