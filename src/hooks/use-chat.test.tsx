import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionChat, type PendingImageAttachment } from "./use-chat";
import { buildHqWebchatSessionKey } from "@shared/hq-webchat-session";

type GatewaySubscriber = (event: {
  type: "event";
  event: string;
  payload?: unknown;
}) => void;

const subscribers = new Set<GatewaySubscriber>();
const request = vi.fn<
  (method: string, params?: Record<string, unknown>) => Promise<unknown>
>();
const client = { request };

vi.mock("./use-gateway", () => ({
  useGateway: () => ({
    client,
    connected: true,
    subscribe: (handler: GatewaySubscriber) => {
      subscribers.add(handler);
      return () => subscribers.delete(handler);
    },
    agents: [],
    snapshot: null,
  }),
}));

async function emitChat(payload: {
  sessionKey: string;
  runId: string;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
}) {
  await act(async () => {
    for (const subscriber of subscribers) {
      subscriber({ type: "event", event: "chat", payload });
    }
    await Promise.resolve();
  });
}

function getSessionKey(agentId = "agent-1", userName = "Tanush Mahalka") {
  return buildHqWebchatSessionKey({ agentId, userName });
}

function getChatSendCalls() {
  return request.mock.calls.filter(([method]) => method === "chat.send");
}

describe("useChat", () => {
  beforeEach(() => {
    subscribers.clear();
    request.mockReset();
    request.mockImplementation(async (method) => {
      if (method === "chat.history") {
        return { messages: [] };
      }
      return {};
    });
  });

  it("filters assistant NO_REPLY from history while preserving user NO_REPLY", async () => {
    request.mockImplementation(async (method) => {
      if (method === "chat.history") {
        return {
          messages: [
            { role: "assistant", content: [{ type: "text", text: "NO_REPLY" }] },
            { role: "assistant", text: "  NO_REPLY  ", content: "real fallback" },
            { role: "user", content: [{ type: "text", text: "NO_REPLY" }] },
            { role: "assistant", content: [{ type: "text", text: "Visible reply" }] },
          ],
        };
      }
      return {};
    });

    const { result } = renderHook(() => useSessionChat(getSessionKey()));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rawMessages).toHaveLength(2);
    expect(result.current.rawMessages[0]?.role).toBe("user");
    expect(result.current.rawMessages[1]?.role).toBe("assistant");
    expect(result.current.rawMessages[0]?.blocks).toMatchObject([
      { type: "text", text: "NO_REPLY" },
    ]);
  });

  it("preserves persisted image blocks from history reloads", async () => {
    request.mockImplementation(async (method) => {
      if (method === "chat.history") {
        return {
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/png",
                    data: "data:image/png;base64,Zm9v",
                  },
                },
              ],
            },
            {
              role: "assistant",
              content: [
                {
                  type: "image_url",
                  image_url: { url: "https://example.com/reply.png" },
                },
              ],
            },
          ],
        };
      }
      return {};
    });

    const { result } = renderHook(() => useSessionChat(getSessionKey()));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rawMessages).toHaveLength(2);
    expect(result.current.rawMessages[0]?.blocks).toMatchObject([
      {
        type: "image",
        dataUrl: "data:image/png;base64,Zm9v",
      },
    ]);
    expect(result.current.rawMessages[1]?.blocks).toMatchObject([
      {
        type: "image",
        url: "https://example.com/reply.png",
      },
    ]);
  });

  it("preserves omitted image metadata blocks from history reloads", async () => {
    request.mockImplementation(async (method) => {
      if (method === "chat.history") {
        return {
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  mimeType: "image/jpeg",
                  omitted: true,
                  bytes: 1291204,
                },
              ],
            },
          ],
        };
      }
      return {};
    });

    const { result } = renderHook(() => useSessionChat(getSessionKey()));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rawMessages).toHaveLength(1);
    expect(result.current.rawMessages[0]?.blocks).toMatchObject([
      {
        type: "image",
        mimeType: "image/jpeg",
        omitted: true,
        bytes: 1291204,
      },
    ]);
  });

  it("suppresses silent-reply deltas and finals from the active run", async () => {
    const { result } = renderHook(() => useSessionChat(getSessionKey()));

    await waitFor(() => expect(result.current.loading).toBe(false));

    let sendOutcome: Awaited<ReturnType<typeof result.current.sendMessage>> = "ignored";
    await act(async () => {
      sendOutcome = await result.current.sendMessage("hello");
    });

    expect(sendOutcome).toBe("sent");
    const firstRunId = getChatSendCalls()[0]?.[1]?.idempotencyKey;
    expect(typeof firstRunId).toBe("string");

    await emitChat({
      sessionKey: getSessionKey(),
      runId: String(firstRunId),
      state: "delta",
      message: { role: "assistant", content: [{ type: "text", text: "NO_REPLY" }] },
    });

    expect(result.current.stream).toBe("");

    await emitChat({
      sessionKey: getSessionKey(),
      runId: String(firstRunId),
      state: "final",
      message: { role: "assistant", content: [{ type: "text", text: "NO_REPLY" }] },
    });

    expect(result.current.isStreaming).toBe(false);
    expect(
      result.current.rawMessages.filter((message) => message.role === "assistant")
    ).toHaveLength(0);
  });

  it("does not queue follow-ups when there is no visible in-flight stream", async () => {
    const { result } = renderHook(() => useSessionChat(getSessionKey()));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await emitChat({
      sessionKey: getSessionKey(),
      runId: "foreign-run",
      state: "delta",
      message: { role: "assistant", content: [{ type: "text", text: "NO_REPLY" }] },
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.isBusy).toBe(false);
    expect(result.current.canAbort).toBe(false);

    let sendOutcome: Awaited<ReturnType<typeof result.current.sendMessage>> = "ignored";
    await act(async () => {
      sendOutcome = await result.current.sendMessage("follow-up");
    });

    expect(sendOutcome).toBe("sent");
    expect(result.current.queue).toHaveLength(0);
    expect(getChatSendCalls()).toHaveLength(1);
  });

  it("queues a follow-up message while busy and flushes it after final", async () => {
    const { result } = renderHook(() => useSessionChat(getSessionKey()));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.sendMessage("first");
    });
    let queuedOutcome: Awaited<ReturnType<typeof result.current.sendMessage>> = "ignored";
    await act(async () => {
      queuedOutcome = await result.current.sendMessage("second");
    });

    expect(queuedOutcome).toBe("queued");
    expect(result.current.queue).toHaveLength(1);
    const firstRunId = getChatSendCalls()[0]?.[1]?.idempotencyKey;

    await emitChat({
      sessionKey: getSessionKey(),
      runId: String(firstRunId),
      state: "final",
      message: { role: "assistant", content: [{ type: "text", text: "done" }] },
    });

    await waitFor(() => expect(getChatSendCalls()).toHaveLength(2));
    expect(result.current.queue).toHaveLength(0);
  });

  it("aborts the active run without clearing the queue and flushes after aborted", async () => {
    const { result } = renderHook(() => useSessionChat(getSessionKey()));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.sendMessage("first");
      await result.current.sendMessage("second");
    });

    expect(result.current.queue).toHaveLength(1);
    const firstRunId = getChatSendCalls()[0]?.[1]?.idempotencyKey;

    await act(async () => {
      await result.current.abortRun();
    });

    expect(request).toHaveBeenCalledWith("chat.abort", {
      sessionKey: getSessionKey(),
      runId: String(firstRunId),
    });
    expect(result.current.queue).toHaveLength(1);

    await emitChat({
      sessionKey: getSessionKey(),
      runId: String(firstRunId),
      state: "aborted",
      message: { role: "assistant", content: [{ type: "text", text: "Stopped" }] },
    });

    await waitFor(() => expect(getChatSendCalls()).toHaveLength(2));
    expect(result.current.queue).toHaveLength(0);
  });

  it("rolls back optimistic user messages on immediate send failure", async () => {
    request.mockImplementation(async (method) => {
      if (method === "chat.history") {
        return { messages: [] };
      }
      if (method === "chat.send") {
        throw new Error("boom");
      }
      return {};
    });

    const { result } = renderHook(() => useSessionChat(getSessionKey()));
    const attachment: PendingImageAttachment = {
      id: "att-1",
      dataUrl: "data:image/png;base64,Zm9v",
      mimeType: "image/png",
      fileName: "shot.png",
    };

    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome: Awaited<ReturnType<typeof result.current.sendMessage>> = "ignored";
    await act(async () => {
      outcome = await result.current.sendMessage("", [attachment]);
    });

    expect(outcome).toBe("error");
    expect(result.current.rawMessages).toHaveLength(0);
    expect(result.current.error).toContain("boom");
  });
});
