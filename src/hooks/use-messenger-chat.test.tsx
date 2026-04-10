import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UIMessage } from "ai";
import { useMessengerChat } from "./use-messenger-chat";
import { buildHqWebchatSessionKey } from "@shared/hq-webchat-session";

const transportInstances: Array<{ config: Record<string, unknown> }> = [];
let latestUseChatOptions: Record<string, unknown> | null = null;

const mockSendMessage = vi.fn<(message?: unknown) => Promise<void>>();
const mockStop = vi.fn();
const mockClearError = vi.fn();

let mockChatState: {
  messages: UIMessage[];
  status: "ready" | "submitted" | "streaming" | "error";
  error: Error | undefined;
} = {
  messages: [],
  status: "ready",
  error: undefined,
};

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");

  class MockDefaultChatTransport {
    config: Record<string, unknown>;

    constructor(config: Record<string, unknown> = {}) {
      this.config = config;
      transportInstances.push(this);
    }
  }

  return {
    ...actual,
    DefaultChatTransport: MockDefaultChatTransport,
  };
});

vi.mock("@ai-sdk/react", () => ({
  useChat: vi.fn((options: Record<string, unknown>) => {
    latestUseChatOptions = options;
    return {
      messages: mockChatState.messages,
      sendMessage: mockSendMessage,
      stop: mockStop,
      status: mockChatState.status,
      error: mockChatState.error,
      clearError: mockClearError,
    };
  }),
}));

function getSessionKey(agentId = "agent-1", userName = "Tanush Mahalka") {
  return buildHqWebchatSessionKey({ agentId, userName });
}

describe("useMessengerChat", () => {
  beforeEach(() => {
    transportInstances.length = 0;
    latestUseChatOptions = null;
    mockSendMessage.mockReset();
    mockSendMessage.mockResolvedValue(undefined);
    mockStop.mockReset();
    mockClearError.mockReset();
    mockChatState = {
      messages: [],
      status: "ready",
      error: undefined,
    };
  });

  it("configures the SDK chat transport with the session metadata", () => {
    const sessionKey = getSessionKey("agent-a", "Tanush Mahalka");

    renderHook(() => useMessengerChat(sessionKey));

    expect(latestUseChatOptions?.id).toBe(sessionKey);
    expect(latestUseChatOptions?.messages).toEqual([
      {
        id: "system-user-tanush-mahalka",
        role: "system",
        parts: [
          {
            type: "text",
            text: "FYI, You are speaking with Tanush Mahalka",
          },
        ],
      },
    ]);
    expect(transportInstances).toHaveLength(1);
    expect(transportInstances[0]?.config).toMatchObject({
      api: "/api/chat",
      credentials: "include",
      body: {
        sessionKey,
        agentId: "agent-a",
        userSlug: "tanush-mahalka",
      },
    });
  });

  it("sends text and uploaded image attachments through the SDK hook", async () => {
    const sessionKey = getSessionKey("agent-a");
    const attachment = {
      id: "attachment-1",
      dataUrl: "data:image/png;base64,Zm9v",
      mimeType: "image/png",
      fileName: "draft.png",
      status: "uploaded" as const,
      publicUrl: "https://cdn.example.com/draft.png",
    };

    const { result } = renderHook(() => useMessengerChat(sessionKey));

    let outcome: Awaited<ReturnType<typeof result.current.sendMessage>> = "ignored";
    await act(async () => {
      outcome = await result.current.sendMessage("Hello", [attachment]);
    });

    expect(outcome).toBe("sent");
    expect(mockClearError).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith({
      text: "Hello",
      files: [
        {
          type: "file",
          mediaType: "image/png",
          filename: "draft.png",
          url: "https://cdn.example.com/draft.png",
        },
      ],
    });
  });

  it("ignores sends while attachments are still uploading", async () => {
    const { result } = renderHook(() => useMessengerChat(getSessionKey("agent-a")));

    let outcome: Awaited<ReturnType<typeof result.current.sendMessage>> = "sent";
    await act(async () => {
      outcome = await result.current.sendMessage("Hello", [
        {
          id: "attachment-1",
          dataUrl: "data:image/png;base64,Zm9v",
          mimeType: "image/png",
          status: "uploading",
        },
      ]);
    });

    expect(outcome).toBe("ignored");
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("adapts SDK UI messages into the existing raw message format", () => {
    mockChatState = {
      messages: [
        {
          id: "user-1",
          role: "user",
          parts: [
            { type: "text", text: "Show me this" },
            {
              type: "file",
              mediaType: "image/png",
              url: "https://cdn.example.com/input.png",
            },
          ],
        },
        {
          id: "assistant-1",
          role: "assistant",
          parts: [
            { type: "reasoning", text: "Thinking through it" },
            { type: "text", text: "Here you go" },
            {
              type: "dynamic-tool",
              toolName: "search",
              toolCallId: "tool-1",
              state: "output-available",
              input: { query: "example" },
              output: { result: "done" },
            },
          ],
        },
      ],
      status: "streaming",
      error: undefined,
    };

    const { result } = renderHook(() => useMessengerChat(getSessionKey("agent-a")));

    expect(result.current.stream).toBe("Thinking through itHere you go");
    expect(result.current.rawMessages).toHaveLength(3);
    expect(result.current.rawMessages[0]).toMatchObject({
      role: "user",
      blocks: [
        { type: "text", text: "Show me this" },
        {
          type: "image",
          url: "https://cdn.example.com/input.png",
          mimeType: "image/png",
        },
      ],
    });
    expect(result.current.rawMessages[1]).toMatchObject({
      role: "assistant",
      blocks: [
        { type: "thinking", thinking: "Thinking through it" },
        { type: "text", text: "Here you go" },
        {
          type: "toolCall",
          id: "tool-1",
          name: "search",
          arguments: { query: "example" },
        },
      ],
    });
    expect(result.current.rawMessages[2]).toMatchObject({
      role: "toolResult",
      blocks: [
        {
          type: "toolResult",
          toolName: "search",
          content: '{\n  "result": "done"\n}',
        },
      ],
    });
  });

  it("converts Hermes inline tool progress text into tool blocks", () => {
    mockChatState = {
      messages: [
        {
          id: "assistant-inline-1",
          role: "assistant",
          parts: [
            {
              type: "text",
              text: "\n\n`pwd` → `/home/ubuntu/.openclaw/workspace`\n\nDone.",
            },
          ],
        },
      ],
      status: "ready",
      error: undefined,
    };

    const { result } = renderHook(() => useMessengerChat(getSessionKey("agent-a")));

    expect(result.current.rawMessages).toHaveLength(2);
    expect(result.current.rawMessages[0]).toMatchObject({
      role: "assistant",
      blocks: [
        {
          type: "toolCall",
          name: "exec",
          arguments: { command: "pwd" },
        },
        {
          type: "text",
          text: "Done.",
        },
      ],
    });
    expect(result.current.rawMessages[1]).toMatchObject({
      role: "toolResult",
      blocks: [
        {
          type: "toolResult",
          toolName: "exec",
          content: "/home/ubuntu/.openclaw/workspace",
        },
      ],
    });
  });

  it("stops the active run only while the SDK hook is busy", async () => {
    mockChatState.status = "streaming";
    const { result, rerender } = renderHook(() =>
      useMessengerChat(getSessionKey("agent-a")),
    );

    let aborted = false;
    await act(async () => {
      aborted = await result.current.abortRun();
    });

    expect(aborted).toBe(true);
    expect(mockStop).toHaveBeenCalledTimes(1);

    mockChatState.status = "ready";
    rerender();

    await act(async () => {
      aborted = await result.current.abortRun();
    });

    expect(aborted).toBe(false);
    expect(mockStop).toHaveBeenCalledTimes(1);
  });
});
