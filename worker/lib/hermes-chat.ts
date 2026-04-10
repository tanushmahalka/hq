import {
  createUIMessageStreamResponse,
  type UIMessageChunk,
} from "ai";
import type { Env } from "../trpc/context.ts";

export type HermesChatConfig = {
  baseUrl: string;
  apiKey?: string;
  model: string;
};

type HermesTextPart = {
  type: "text";
  text: string;
};

type HermesImagePart = {
  type: "image_url";
  image_url: {
    url: string;
  };
};

type HermesMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<HermesTextPart | HermesImagePart>;
};

type HermesToolCallDelta = {
  index?: number;
  id?: string;
  function?: {
    name?: string;
    arguments?: unknown;
  };
};

type HermesParsedChunk = {
  text: string;
  toolCalls: HermesToolCallDelta[];
  finishReason?: HermesUiFinishReason;
};

type HermesUiFinishReason =
  | "stop"
  | "length"
  | "content-filter"
  | "tool-calls"
  | "error"
  | "other";

type PendingHermesToolCall = {
  toolCallId: string;
  toolName: string;
  inputText: string;
  started: boolean;
  finalized: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function extractLegacyContentText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (!isRecord(part)) {
        return "";
      }

      const text = part.text;
      return typeof text === "string" ? text : "";
    })
    .join("");
}

function normalizeFinishReason(value: unknown): HermesUiFinishReason | undefined {
  if (value === "stop" || value === "length" || value === "error" || value === "other") {
    return value;
  }

  if (value === "content_filter" || value === "content-filter") {
    return "content-filter";
  }

  if (value === "tool_calls" || value === "tool-calls") {
    return "tool-calls";
  }

  return undefined;
}

export function getHermesChatConfig(env: Env): HermesChatConfig | null {
  const rawBaseUrl = env.HERMES_API_URL?.trim();
  if (!rawBaseUrl) {
    return null;
  }

  return {
    baseUrl: rawBaseUrl.replace(/\/+$/, ""),
    apiKey: env.HERMES_API_KEY?.trim() || undefined,
    model: env.HERMES_MODEL?.trim() || "hermes-agent",
  };
}

export function uiMessagesToHermesMessages(messages: unknown): HermesMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  const converted: HermesMessage[] = [];

  for (const message of messages) {
    if (!isRecord(message)) {
      continue;
    }

    const role =
      message.role === "system" ||
      message.role === "user" ||
      message.role === "assistant"
        ? message.role
        : null;

    if (!role) {
      continue;
    }

    const parts = Array.isArray(message.parts) ? message.parts : [];
    const text = parts
      .map((part) => {
        if (!isRecord(part)) {
          return "";
        }

        if (part.type === "text" || part.type === "reasoning") {
          return normalizeText(part.text);
        }

        return "";
      })
      .join("");

    const imageParts =
      role === "user"
        ? parts.flatMap((part) => {
            if (!isRecord(part)) {
              return [];
            }

            if (part.type !== "file") {
              return [];
            }

            const mediaType = normalizeText(part.mediaType);
            const url = normalizeText(part.url);
            if (!mediaType.startsWith("image/") || !url) {
              return [];
            }

            return [
              {
                type: "image_url" as const,
                image_url: { url },
              },
            ];
          })
        : [];

    if (imageParts.length > 0) {
      const content: Array<HermesTextPart | HermesImagePart> = [];
      if (text.trim()) {
        content.push({ type: "text", text });
      }
      content.push(...imageParts);
      converted.push({ role, content });
      continue;
    }

    const legacyText = extractLegacyContentText(message.content);
    const resolvedText = text || legacyText;
    if (!resolvedText.trim()) {
      continue;
    }

    converted.push({ role, content: resolvedText });
  }

  return converted;
}

function parseHermesChunk(payload: string): HermesParsedChunk | null {
  if (!payload || payload === "[DONE]") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const choices = Array.isArray(parsed.choices) ? parsed.choices : [];
  const firstChoice = choices[0];
  if (!isRecord(firstChoice)) {
    return null;
  }

  const delta = isRecord(firstChoice.delta) ? firstChoice.delta : null;
  const finishReason = normalizeFinishReason(firstChoice.finish_reason);
  let text = "";

  if (delta) {
    if (typeof delta.content === "string") {
      text = delta.content;
    } else if (Array.isArray(delta.content)) {
      text = delta.content
        .map((part) => {
          if (!isRecord(part)) {
            return "";
          }

          if (typeof part.text === "string") {
            return part.text;
          }

          return typeof part.input_text === "string" ? part.input_text : "";
        })
        .join("");
    }
  }

  const toolCalls =
    delta && Array.isArray(delta.tool_calls)
      ? delta.tool_calls.filter(isRecord).map((toolCall) => ({
          index:
            typeof toolCall.index === "number" ? toolCall.index : undefined,
          id: normalizeText(toolCall.id) || undefined,
          function: isRecord(toolCall.function)
            ? {
                name: normalizeText(toolCall.function.name) || undefined,
                arguments: toolCall.function.arguments,
              }
            : undefined,
        }))
      : [];

  return { text, toolCalls, finishReason };
}

export function extractHermesDeltaText(payload: string): string {
  return parseHermesChunk(payload)?.text ?? "";
}

function parseToolInput(inputText: string): Record<string, unknown> {
  if (!inputText.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(inputText);
    return isRecord(parsed) ? parsed : { value: parsed };
  } catch {
    return { rawInput: inputText };
  }
}

function createHermesToolCallState() {
  const pendingByKey = new Map<string, PendingHermesToolCall>();
  const keyByIndex = new Map<number, string>();
  const keyByHermesId = new Map<string, string>();
  let nextSyntheticKey = 1;
  let nextToolCallId = 1;

  function resolveKey(delta: HermesToolCallDelta): string {
    if (delta.id && keyByHermesId.has(delta.id)) {
      return keyByHermesId.get(delta.id)!;
    }

    if (typeof delta.index === "number" && keyByIndex.has(delta.index)) {
      const key = keyByIndex.get(delta.index)!;
      if (delta.id) {
        keyByHermesId.set(delta.id, key);
      }
      return key;
    }

    const key = delta.id
      ? `hermes:${delta.id}`
      : typeof delta.index === "number"
        ? `index:${delta.index}`
        : `synthetic:${nextSyntheticKey++}`;

    if (delta.id) {
      keyByHermesId.set(delta.id, key);
    }
    if (typeof delta.index === "number") {
      keyByIndex.set(delta.index, key);
    }

    return key;
  }

  return {
    pendingByKey,
    resolveKey,
    createToolCallId() {
      return `tool-call-${nextToolCallId++}`;
    },
  };
}

export function createHermesUiMessageStreamResponse(upstream: Response): Response {
  const stream = new ReadableStream<UIMessageChunk>({
    start(controller) {
      controller.enqueue({ type: "start" });
      controller.enqueue({ type: "start-step" });

      if (!upstream.body) {
        controller.enqueue({ type: "finish" });
        controller.close();
        return;
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      const toolState = createHermesToolCallState();
      let buffer = "";
      let textStarted = false;
      let textClosed = false;
      let streamClosed = false;
      let finishReason: HermesUiFinishReason | undefined;

      function ensureTextStarted() {
        if (textStarted) {
          return;
        }

        textStarted = true;
        controller.enqueue({ type: "text-start", id: "text-1" });
      }

      function closeTextPart() {
        if (!textStarted || textClosed) {
          return;
        }

        textClosed = true;
        controller.enqueue({ type: "text-end", id: "text-1" });
      }

      function getPendingToolCall(delta: HermesToolCallDelta): PendingHermesToolCall {
        const key = toolState.resolveKey(delta);
        const existing = toolState.pendingByKey.get(key);
        if (existing) {
          return existing;
        }

        const pending: PendingHermesToolCall = {
          toolCallId: toolState.createToolCallId(),
          toolName: "tool",
          inputText: "",
          started: false,
          finalized: false,
        };

        toolState.pendingByKey.set(key, pending);
        return pending;
      }

      function finalizePendingToolCalls() {
        for (const pending of toolState.pendingByKey.values()) {
          if (pending.finalized) {
            continue;
          }

          pending.finalized = true;
          controller.enqueue({
            type: "tool-input-available",
            dynamic: true,
            toolCallId: pending.toolCallId,
            toolName: pending.toolName || "tool",
            input: parseToolInput(pending.inputText),
          });

          console.log(
            "[/api/chat] streamed tool:",
            pending.toolName || "tool",
            pending.inputText,
          );
        }
      }

      function closeStream() {
        if (streamClosed) {
          return;
        }

        streamClosed = true;
        finalizePendingToolCalls();
        closeTextPart();
        controller.enqueue({ type: "finish-step" });
        controller.enqueue({ type: "finish", finishReason });
        controller.close();
      }

      function handlePayload(payload: string): boolean {
        if (payload === "[DONE]") {
          closeStream();
          return true;
        }

        const parsed = parseHermesChunk(payload);
        if (!parsed) {
          return false;
        }

        if (parsed.finishReason) {
          finishReason = parsed.finishReason;
        }

        if (parsed.text) {
          ensureTextStarted();
          controller.enqueue({
            type: "text-delta",
            id: "text-1",
            delta: parsed.text,
          });
          console.log("[/api/chat] streamed chunk:", parsed.text);
        }

        for (const toolCallDelta of parsed.toolCalls) {
          const pending = getPendingToolCall(toolCallDelta);
          const nameDelta = normalizeText(toolCallDelta.function?.name);
          const argumentsDelta =
            typeof toolCallDelta.function?.arguments === "string"
              ? toolCallDelta.function.arguments
              : "";

          if (nameDelta) {
            pending.toolName =
              pending.toolName === "tool"
                ? nameDelta
                : `${pending.toolName}${nameDelta}`;
          }

          if (!pending.started) {
            pending.started = true;
            controller.enqueue({
              type: "tool-input-start",
              dynamic: true,
              toolCallId: pending.toolCallId,
              toolName: pending.toolName || "tool",
            });
          }

          if (argumentsDelta) {
            pending.inputText += argumentsDelta;
            controller.enqueue({
              type: "tool-input-delta",
              toolCallId: pending.toolCallId,
              inputTextDelta: argumentsDelta,
            });
          }
        }

        if (parsed.finishReason === "tool-calls") {
          finalizePendingToolCalls();
        }

        return false;
      }

      function processBuffer(flush = false) {
        const separator = /\r?\n\r?\n/;
        let match = separator.exec(buffer);

        while (match) {
          const eventBlock = buffer.slice(0, match.index);
          buffer = buffer.slice(match.index + match[0].length);

          const payload = eventBlock
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n");

          if (handlePayload(payload)) {
            return true;
          }

          match = separator.exec(buffer);
        }

        if (flush && buffer.trim()) {
          const payload = buffer
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n");

          if (handlePayload(payload)) {
            return true;
          }
        }

        return false;
      }

      async function pump() {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              processBuffer(true);
              closeStream();
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            if (processBuffer()) {
              return;
            }
          }
        } catch (error) {
          controller.error(error);
        }
      }

      void pump();
    },
  });

  return createUIMessageStreamResponse({
    status: upstream.status,
    stream,
  });
}
