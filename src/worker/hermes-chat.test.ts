import { once } from "node:events";
import http from "node:http";
import { describe, expect, it } from "vitest";
import {
  createHermesUiMessageStreamResponse,
  extractHermesDeltaText,
  getHermesChatConfig,
  requestHermesChatCompletion,
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

  it("streams Hermes chat completions over raw http without using fetch body timeouts", async () => {
    const requests: Array<{
      authorization?: string;
      sessionId?: string;
      body: string;
    }> = [];

    const server = http.createServer((req, res) => {
      let body = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        requests.push({
          path: req.url,
          authorization: req.headers.authorization,
          sessionId:
            typeof req.headers["x-hermes-session-id"] === "string"
              ? req.headers["x-hermes-session-id"]
              : undefined,
          body,
        });

        res.writeHead(200, {
          "content-type": "text/event-stream",
        });
        res.write('data: {"choices":[{"delta":{"content":"Hello from Hermes"}}]}\n\n');
        res.end("data: [DONE]\n\n");
      });
    });

    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected test server to bind to a TCP port.");
      }

      const upstream = await requestHermesChatCompletion({
        hermes: {
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          apiKey: "test-key",
          model: "hermes-agent",
        },
        sessionKey: "agent:test:hq:webchat:user:tanush-mahalka",
        messages: [{ role: "user", content: "Hello" }],
      });

      expect(upstream.status).toBe(200);
      expect(upstream.headers.get("x-hq-hermes-upstream-url")).toBe(
        `http://127.0.0.1:${address.port}/v1/chat/completions`
      );
      await expect(upstream.text()).resolves.toContain("Hello from Hermes");
      expect(requests).toEqual([
        {
          path: "/v1/chat/completions",
          authorization: "Bearer test-key",
          sessionId: "agent:test:hq:webchat:user:tanush-mahalka",
          body: JSON.stringify({
            model: "hermes-agent",
            stream: true,
            messages: [{ role: "user", content: "Hello" }],
          }),
        },
      ]);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
