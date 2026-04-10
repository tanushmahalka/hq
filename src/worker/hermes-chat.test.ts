import { describe, expect, it } from "vitest";
import {
  createHermesUiMessageStreamResponse,
  extractHermesDeltaText,
  getHermesChatConfig,
  uiMessagesToHermesMessages,
} from "../../worker/lib/hermes-chat.ts";

describe("hermes chat helpers", () => {
  it("builds Hermes config from env", () => {
    expect(
      getHermesChatConfig({
        DATABASE_URL: "postgres://example.test/hq",
        BETTER_AUTH_SECRET: "secret",
        BETTER_AUTH_URL: "http://localhost:8787",
        HERMES_API_URL: "https://hermes.example.com/v1/",
        HERMES_API_KEY: "test-key",
        HERMES_MODEL: "agent-alpha",
      }),
    ).toEqual({
      baseUrl: "https://hermes.example.com/v1",
      apiKey: "test-key",
      model: "agent-alpha",
    });
  });

  it("converts UI messages into Hermes chat messages", () => {
    expect(
      uiMessagesToHermesMessages([
        {
          role: "system",
          parts: [{ type: "text", text: "Be concise." }],
        },
        {
          role: "user",
          parts: [
            { type: "text", text: "Check this image" },
            {
              type: "file",
              mediaType: "image/png",
              url: "https://cdn.example.com/demo.png",
            },
          ],
        },
        {
          role: "assistant",
          parts: [{ type: "text", text: "Looks good." }],
        },
      ]),
    ).toEqual([
      { role: "system", content: "Be concise." },
      {
        role: "user",
        content: [
          { type: "text", text: "Check this image" },
          {
            type: "image_url",
            image_url: { url: "https://cdn.example.com/demo.png" },
          },
        ],
      },
      { role: "assistant", content: "Looks good." },
    ]);
  });

  it("extracts text deltas from Hermes streaming payloads", () => {
    expect(
      extractHermesDeltaText(
        JSON.stringify({
          choices: [
            {
              delta: {
                content: "Hello",
              },
            },
          ],
        }),
      ),
    ).toBe("Hello");
  });

  it("translates Hermes tool-call deltas into UI message chunks", async () => {
    const upstream = new Response(
      [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"todo","arguments":"{\\"task\\":"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"write tests\\"}"}}],"content":"Done."},"finish_reason":"tool_calls"}]}\n\n',
        "data: [DONE]\n\n",
      ].join(""),
      {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
        },
      },
    );

    const response = createHermesUiMessageStreamResponse(upstream);
    const body = await response.text();

    expect(body).toContain('"type":"tool-input-start"');
    expect(body).toContain('"toolName":"todo"');
    expect(body).toContain('"type":"tool-input-available"');
    expect(body).toContain('"task":"write tests"');
    expect(body).toContain('"type":"text-delta"');
    expect(body).toContain('"delta":"Done."');
  });
});
