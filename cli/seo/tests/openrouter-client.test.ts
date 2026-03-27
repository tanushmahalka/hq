import assert from "node:assert/strict";
import test from "node:test";

import { OpenRouterClient } from "../src/providers/openrouter/client.ts";

test("OpenRouterClient sends a chat completion request and parses boolean output", async () => {
  const client = new OpenRouterClient({
    config: {
      apiKey: "openrouter-key",
      baseUrl: "https://openrouter.ai/api/v1",
    },
    fetchImpl: async (input, init) => {
      assert.equal(String(input), "https://openrouter.ai/api/v1/chat/completions");
      assert.equal(init?.method, "POST");
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer openrouter-key");

      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "openai/gpt-oss-120b");
      assert.match(body.messages[1].content, /Here is about the brand:/);

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "true",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    },
  });

  const result = await client.classifyKeyword({
    query: "enterprise seo platform",
    brandOverview: "Brand overview for an enterprise SEO software company.",
    model: "openai/gpt-oss-120b",
  });

  assert.deepEqual(result, {
    query: "enterprise seo platform",
    relevant: true,
  });
});

test("OpenRouterClient surfaces non-2xx errors with retry hints", async () => {
  const client = new OpenRouterClient({
    config: {
      apiKey: "openrouter-key",
      baseUrl: "https://openrouter.ai/api/v1",
    },
    fetchImpl: async () =>
      new Response("rate limited", {
        status: 429,
        headers: { "retry-after": "2" },
      }),
  });

  await assert.rejects(
    client.classifyKeyword({
      query: "seo agency pricing",
      brandOverview: "An SEO agency for B2B SaaS teams.",
    }),
    /429[\s\S]*Retry after 2 second\(s\)[\s\S]*rate limited/,
  );
});
