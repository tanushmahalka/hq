import assert from "node:assert/strict";
import test from "node:test";

import { TwentyClient } from "../src/providers/twenty/client.ts";

test("client retries idempotent requests and injects bearer auth", async () => {
  let attempts = 0;
  const client = new TwentyClient({
    config: {
      baseUrl: "https://example.com/rest/",
      token: "secret-token",
      timeoutMs: 1000,
      context: {},
    },
    fetchImpl: async (_input, init) => {
      attempts += 1;
      assert.equal(init?.headers && (init.headers as Record<string, string>).Authorization, "Bearer secret-token");
      if (attempts === 1) {
        return new Response(JSON.stringify({ error: "temporary" }), { status: 503, headers: { "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  const response = await client.request<{ ok: boolean }>({
    method: "GET",
    path: "/people",
  });

  assert.equal(attempts, 2);
  assert.deepEqual(response.data, { ok: true });
});
