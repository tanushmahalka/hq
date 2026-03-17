import assert from "node:assert/strict";
import test from "node:test";

import { DataForSeoClient } from "../src/providers/dataforseo/client.ts";

test("DataForSeoClient throws when a returned task has a non-20000 status", async () => {
  const client = new DataForSeoClient(
    {
      login: "login",
      password: "password",
      baseUrl: "https://api.dataforseo.com",
    },
    async () =>
      new Response(
        JSON.stringify({
          status_code: 20000,
          status_message: "Ok.",
          tasks_count: 1,
          tasks_error: 1,
          cost: 0,
          tasks: [
            {
              id: "task-1",
              status_code: 50301,
              status_message: "3rd Party API Service Unavailable (overloaded).",
              time: "0.1 sec.",
              cost: 0,
              result_count: 0,
              path: ["v3", "ai_optimization", "claude", "llm_responses", "live"],
              data: {},
              result: null,
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
  );

  await assert.rejects(
    client.llmResponseLive("claude", {
      userPrompt: "test prompt",
      webSearch: true,
    }),
    /DataForSEO task error 50301/,
  );
});
