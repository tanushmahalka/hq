import assert from "node:assert/strict";
import test from "node:test";

import { DataForSeoClient } from "../src/providers/dataforseo/client.ts";

test("DataForSeoClient posts backlinks bulk ranks to the documented endpoint", async () => {
  let requestedUrl = "";
  let requestedBody = "";

  const client = new DataForSeoClient(
    {
      login: "login",
      password: "password",
      baseUrl: "https://api.dataforseo.com",
    },
    async (input, init) => {
      requestedUrl = String(input);
      requestedBody = String(init?.body);

      return new Response(
        JSON.stringify({
          status_code: 20000,
          status_message: "Ok.",
          tasks_count: 1,
          tasks_error: 0,
          cost: 0.0049,
          tasks: [
            {
              id: "task-1",
              status_code: 20000,
              status_message: "Ok.",
              time: "0.1 sec.",
              cost: 0.0049,
              result_count: 1,
              path: ["v3", "backlinks", "bulk_ranks", "live"],
              data: {},
              result: [{ items_count: 1, items: [{ target: "example.com", rank: 611 }] }],
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    },
  );

  const task = await client.backlinksBulkRanks({
    targets: ["example.com"],
    rankScale: "one_hundred",
  });

  assert.equal(requestedUrl, "https://api.dataforseo.com/v3/backlinks/bulk_ranks/live");
  assert.equal(requestedBody, '[{"targets":["example.com"],"rank_scale":"one_hundred"}]');
  assert.equal(task.result?.[0]?.items?.[0]?.rank, 611);
});

test("DataForSeoClient posts backlinks bulk spam score to the documented endpoint", async () => {
  let requestedUrl = "";
  let requestedBody = "";

  const client = new DataForSeoClient(
    {
      login: "login",
      password: "password",
      baseUrl: "https://api.dataforseo.com",
    },
    async (input, init) => {
      requestedUrl = String(input);
      requestedBody = String(init?.body);

      return new Response(
        JSON.stringify({
          status_code: 20000,
          status_message: "Ok.",
          tasks_count: 1,
          tasks_error: 0,
          cost: 0.0049,
          tasks: [
            {
              id: "task-1",
              status_code: 20000,
              status_message: "Ok.",
              time: "0.1 sec.",
              cost: 0.0049,
              result_count: 1,
              path: ["v3", "backlinks", "bulk_spam_score", "live"],
              data: {},
              result: [{ items_count: 1, items: [{ target: "example.com", spam_score: 8 }] }],
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    },
  );

  const task = await client.backlinksBulkSpamScore({
    targets: ["example.com"],
  });

  assert.equal(requestedUrl, "https://api.dataforseo.com/v3/backlinks/bulk_spam_score/live");
  assert.equal(requestedBody, '[{"targets":["example.com"]}]');
  assert.equal(task.result?.[0]?.items?.[0]?.spam_score, 8);
});

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
