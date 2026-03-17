import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { MessengerChatProvider, useMessengerChat } from "./use-messenger-chat";

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

function Wrapper({ children }: { children: ReactNode }) {
  return <MessengerChatProvider>{children}</MessengerChatProvider>;
}

function getSessionKey(agentId = "agent-1") {
  return `agent:${agentId}:webchat`;
}

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

async function emitAgent(payload: {
  sessionKey?: string;
  runId: string;
  stream: string;
  ts?: number;
  data?: Record<string, unknown>;
}) {
  await act(async () => {
    for (const subscriber of subscribers) {
      subscriber({ type: "event", event: "agent", payload });
    }
    await Promise.resolve();
  });
}

describe("useMessengerChat", () => {
  beforeEach(() => {
    subscribers.clear();
    request.mockReset();
    request.mockImplementation(async (method, params) => {
      if (method === "chat.history") {
        return { messages: [], sessionKey: params?.sessionKey };
      }
      return {};
    });
  });

  it("keeps busy state isolated when switching sessions", async () => {
    const { result, rerender } = renderHook(
      ({ sessionKey }) => useMessengerChat(sessionKey),
      {
        initialProps: { sessionKey: getSessionKey("agent-a") },
        wrapper: Wrapper,
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    let sendOutcome: Awaited<ReturnType<typeof result.current.sendMessage>> = "ignored";
    await act(async () => {
      sendOutcome = await result.current.sendMessage("hello");
    });

    expect(sendOutcome).toBe("sent");
    const runId = request.mock.calls.find(([method]) => method === "chat.send")?.[1]
      ?.idempotencyKey;
    expect(typeof runId).toBe("string");

    await emitChat({
      sessionKey: getSessionKey("agent-a"),
      runId: String(runId),
      state: "delta",
      message: { role: "assistant", content: [{ type: "text", text: "Working" }] },
    });

    expect(result.current.isBusy).toBe(true);
    expect(result.current.stream).toBe("Working");

    rerender({ sessionKey: getSessionKey("agent-b") });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isBusy).toBe(false);
    expect(result.current.stream).toBeNull();

    await act(async () => {
      sendOutcome = await result.current.sendMessage("second");
    });

    expect(sendOutcome).toBe("sent");
    expect(
      request.mock.calls.filter(([method, params]) => {
        return method === "chat.send" && params?.sessionKey === getSessionKey("agent-b");
      }),
    ).toHaveLength(1);
  });

  it("preserves per-session drafts and attachments", async () => {
    const attachment = {
      id: "attachment-1",
      dataUrl: "data:image/png;base64,Zm9v",
      mimeType: "image/png",
      fileName: "draft.png",
    };

    const { result, rerender } = renderHook(
      ({ sessionKey }) => useMessengerChat(sessionKey),
      {
        initialProps: { sessionKey: getSessionKey("agent-a") },
        wrapper: Wrapper,
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setDraft("Draft A");
      result.current.addAttachments([attachment]);
    });

    rerender({ sessionKey: getSessionKey("agent-b") });

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setDraft("Draft B");
    });

    expect(result.current.draft).toBe("Draft B");
    expect(result.current.attachments).toHaveLength(0);

    rerender({ sessionKey: getSessionKey("agent-a") });

    expect(result.current.draft).toBe("Draft A");
    expect(result.current.attachments).toMatchObject([attachment]);
  });

  it("shows cached thinking when reopening a hidden in-flight session, then reconciles", async () => {
    let agentAFinalVisible = false;
    request.mockImplementation(async (method, params) => {
      if (method === "chat.history") {
        if (params?.sessionKey === getSessionKey("agent-a") && agentAFinalVisible) {
          const now = Date.now();
          return {
            messages: [
              {
                role: "user",
                timestamp: now - 50,
                content: [{ type: "text", text: "hello" }],
              },
              {
                role: "assistant",
                timestamp: now + 50,
                content: [{ type: "text", text: "Done" }],
              },
            ],
          };
        }
        return { messages: [] };
      }
      return {};
    });

    const { result, rerender } = renderHook(
      ({ sessionKey }) => useMessengerChat(sessionKey),
      {
        initialProps: { sessionKey: getSessionKey("agent-a") },
        wrapper: Wrapper,
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    const runId = request.mock.calls.find(([method]) => method === "chat.send")?.[1]
      ?.idempotencyKey;

    await emitChat({
      sessionKey: getSessionKey("agent-a"),
      runId: String(runId),
      state: "delta",
      message: { role: "assistant", content: [{ type: "text", text: "Working" }] },
    });

    rerender({ sessionKey: getSessionKey("agent-b") });
    await waitFor(() => expect(result.current.loading).toBe(false));

    agentAFinalVisible = true;
    await emitChat({
      sessionKey: getSessionKey("agent-a"),
      runId: String(runId),
      state: "final",
      message: { role: "assistant", content: [{ type: "text", text: "Done" }] },
    });

    rerender({ sessionKey: getSessionKey("agent-a") });

    expect(result.current.stream).toBe("Working");
    expect(result.current.isBusy).toBe(true);

    await waitFor(() => expect(result.current.isBusy).toBe(false));
    expect(result.current.stream).toBeNull();
    expect(
      result.current.rawMessages.some((message) =>
        message.blocks.some(
          (block) => block.type === "text" && block.text === "Done",
        ),
      ),
    ).toBe(true);
  });

  it("streams assistant text from raw agent websocket events", async () => {
    const { result } = renderHook(
      ({ sessionKey }) => useMessengerChat(sessionKey),
      {
        initialProps: { sessionKey: getSessionKey("agent-a") },
        wrapper: Wrapper,
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    await emitAgent({
      sessionKey: getSessionKey("agent-a"),
      runId: "run-agent-stream",
      stream: "assistant",
      data: {
        text:
          "I've confirmed the site itself is on Framer. The remaining question is whether I can only",
        delta: " only",
      },
    });

    expect(result.current.stream).toBe(
      "I've confirmed the site itself is on Framer. The remaining question is whether I can only",
    );
    expect(result.current.rawMessages).toHaveLength(0);
  });

  it("reconciles a visible session from raw agent lifecycle events when chat events are absent", async () => {
    let agentAFinalVisible = false;
    request.mockImplementation(async (method, params) => {
      if (method === "chat.history") {
        if (params?.sessionKey === getSessionKey("agent-a") && agentAFinalVisible) {
          const now = Date.now();
          return {
            messages: [
              {
                role: "user",
                timestamp: now - 50,
                content: [{ type: "text", text: "hello" }],
              },
              {
                role: "assistant",
                timestamp: now + 50,
                content: [{ type: "text", text: "Done" }],
              },
            ],
          };
        }
        return { messages: [] };
      }
      return {};
    });

    const { result } = renderHook(
      ({ sessionKey }) => useMessengerChat(sessionKey),
      {
        initialProps: { sessionKey: getSessionKey("agent-a") },
        wrapper: Wrapper,
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    await emitAgent({
      sessionKey: getSessionKey("agent-a"),
      runId: "run-agent-lifecycle",
      stream: "assistant",
      data: {
        text: "Working",
        delta: "Working",
      },
    });

    expect(result.current.stream).toBe("Working");

    agentAFinalVisible = true;
    await emitAgent({
      sessionKey: getSessionKey("agent-a"),
      runId: "run-agent-lifecycle",
      stream: "lifecycle",
      data: {
        phase: "end",
      },
    });

    await waitFor(() => expect(result.current.stream).toBeNull());
    expect(
      result.current.rawMessages.some((message) =>
        message.blocks.some(
          (block) => block.type === "text" && block.text === "Done",
        ),
      ),
    ).toBe(true);

  });

  it("marks hidden sessions dirty when only raw agent lifecycle events arrive", async () => {
    let agentAFinalVisible = false;
    request.mockImplementation(async (method, params) => {
      if (method === "chat.history") {
        if (params?.sessionKey === getSessionKey("agent-a") && agentAFinalVisible) {
          const now = Date.now();
          return {
            messages: [
              {
                role: "user",
                timestamp: now - 50,
                content: [{ type: "text", text: "hello" }],
              },
              {
                role: "assistant",
                timestamp: now + 50,
                content: [{ type: "text", text: "Done" }],
              },
            ],
          };
        }
        return { messages: [] };
      }
      return {};
    });

    const { result, rerender } = renderHook(
      ({ sessionKey }) => useMessengerChat(sessionKey),
      {
        initialProps: { sessionKey: getSessionKey("agent-a") },
        wrapper: Wrapper,
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ sessionKey: getSessionKey("agent-b") });
    await waitFor(() => expect(result.current.loading).toBe(false));

    agentAFinalVisible = true;
    await emitAgent({
      sessionKey: getSessionKey("agent-a"),
      runId: "run-agent-hidden",
      stream: "lifecycle",
      data: {
        phase: "end",
      },
    });

    rerender({ sessionKey: getSessionKey("agent-a") });
    await waitFor(() =>
      expect(
        result.current.rawMessages.some((message) =>
          message.blocks.some(
            (block) => block.type === "text" && block.text === "Done",
          ),
        ),
      ).toBe(true),
    );
  });
});
