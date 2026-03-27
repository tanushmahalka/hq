import assert from "node:assert/strict";
import test from "node:test";

import { runKeywordsClassifyRelevanceCommand } from "../src/commands/keywords/classify-relevance.ts";

test("runKeywordsClassifyRelevanceCommand renders a single-query classification", async () => {
  const payloads: unknown[] = [];

  await runKeywordsClassifyRelevanceCommand(
    ["--query", "b2b seo software", "--brand", "A B2B SEO platform for in-house growth teams."],
    {
      resolvedConfig: {
        apiKey: "openrouter-key",
        baseUrl: "https://openrouter.ai/api/v1",
      },
      createClient: () => ({
        async classifyKeyword({ query }) {
          return {
            query,
            rationale: "The query matches the product and likely buyer intent.",
            relevant: true,
          };
        },
      }),
      printJsonImpl: (value) => {
        payloads.push(value);
      },
    },
  );

  assert.deepEqual(payloads, [
    {
      rationale: "The query matches the product and likely buyer intent.",
      isRelevant: true,
    },
  ]);
});

test("runKeywordsClassifyRelevanceCommand emits JSONL rows for batch mode", async () => {
  const stdout: string[] = [];

  await runKeywordsClassifyRelevanceCommand(
    ["--jsonl", "-", "--brand", "A B2B SEO platform for in-house growth teams.", "--concurrency", "2"],
    {
      resolvedConfig: {
        apiKey: "openrouter-key",
        baseUrl: "https://openrouter.ai/api/v1",
      },
      readStdinImpl: async () =>
        [
          JSON.stringify({ query: "enterprise seo software", volume: 1000 }),
          JSON.stringify({ keyword: "free seo checker", volume: 5000 }),
        ].join("\n"),
      createClient: () => ({
        async classifyKeyword({ query }) {
          return {
            query,
            rationale: `classification for ${query}`,
            relevant: query === "enterprise seo software",
          };
        },
      }),
      writeStdoutImpl: (value) => {
        stdout.push(value);
      },
    },
  );

  const rows = stdout.map((line) => JSON.parse(line));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    query: "enterprise seo software",
    volume: 1000,
    rationale: "classification for enterprise seo software",
    isRelevant: true,
  });
  assert.deepEqual(rows[1], {
    keyword: "free seo checker",
    volume: 5000,
    query: "free seo checker",
    rationale: "classification for free seo checker",
    isRelevant: false,
  });
});

test("runKeywordsClassifyRelevanceCommand retries rate-limited requests", async () => {
  const sleepCalls: number[] = [];
  let attempts = 0;

  const payloads: unknown[] = [];

  await runKeywordsClassifyRelevanceCommand(
    ["--query", "seo agency pricing", "--brand", "An SEO agency for B2B SaaS companies.", "--json"],
    {
      resolvedConfig: {
        apiKey: "openrouter-key",
        baseUrl: "https://openrouter.ai/api/v1",
      },
      createClient: () => ({
        async classifyKeyword({ query }) {
          attempts += 1;
          if (attempts === 1) {
            throw new Error("OpenRouter request failed with 429. Retry after 2 second(s).");
          }

          return {
            query,
            rationale: "Some agency-intent traffic could still be valuable.",
            relevant: true,
          };
        },
      }),
      sleepImpl: async (ms) => {
        sleepCalls.push(ms);
      },
      printJsonImpl: (value) => {
        payloads.push(value);
      },
    },
  );

  assert.equal(attempts, 2);
  assert.deepEqual(sleepCalls, [2000]);
  assert.deepEqual(payloads[0], {
    rationale: "Some agency-intent traffic could still be valuable.",
    isRelevant: true,
  });
});
