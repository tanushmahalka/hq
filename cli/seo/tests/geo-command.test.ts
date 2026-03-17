import assert from "node:assert/strict";
import test from "node:test";

import { runGeoCommand } from "../src/commands/geo/index.ts";

test("runGeoCommand renders brand visibility in human-readable mode", async () => {
  const lines: string[] = [];

  await runGeoCommand(
    ["brand-visibility", "--domain", "example.com"],
    {
      resolvedConfig: {
        login: "login",
        password: "password",
        baseUrl: "https://api.dataforseo.com",
      },
      createClient: () => ({
        async llmMentionsSearch(options) {
          return mentionTask([
            {
              question: "best crm",
              answer: "Try example.com",
              sources: [{ url: "https://example.com/guide" }],
            },
          ], options.platform);
        },
        async llmMentionsAggregatedMetrics(options) {
          return simpleTask([{ key: options.platform, mention_count: 2 }]);
        },
        async llmMentionsTopDomains(options) {
          return simpleTask([{ domain: "example.com", mention_count: 2 }], options.platform);
        },
        async llmMentionsTopPages(options) {
          return simpleTask([{ url: "https://example.com/guide", mention_count: 2 }], options.platform);
        },
        async llmMentionsCrossAggregatedMetrics() {
          throw new Error("not used");
        },
        async aiKeywordSearchVolume() {
          throw new Error("not used");
        },
        async llmResponseLive() {
          throw new Error("not used");
        },
      }),
      printLineImpl: (value = "") => {
        lines.push(value);
      },
    },
  );

  assert.equal(lines[0], "Brand visibility for example.com");
  assert.equal(lines[1], "Mentions: 4");
  assert.ok(lines.includes("platform\tmentions\tcitations"));
  assert.ok(lines.some((line) => line.includes("https://example.com/guide")));
});

test("runGeoCommand emits normalized JSON for topic sizing", async () => {
  let output = "";

  await runGeoCommand(
    ["topic-sizing", "--domain", "example.com", "--keyword", "crm software", "--json"],
    {
      resolvedConfig: {
        login: "login",
        password: "password",
        baseUrl: "https://api.dataforseo.com",
      },
      createClient: () => ({
        async aiKeywordSearchVolume() {
          return {
            id: "keywords",
            status_code: 20000,
            status_message: "Ok.",
            time: "0.1 sec.",
            cost: 0.01,
            result_count: 1,
            path: ["v3", "ai_optimization"],
            data: {},
            result: [
              {
                items: [{ keyword: "crm software", search_volume_last_month: 42, monthly_searches: [{ search_volume: 42 }] }],
              },
            ],
          };
        },
        async llmMentionsTopDomains(options) {
          return simpleTask([{ domain: "example.com", mention_count: 1 }], options.platform);
        },
        async llmMentionsTopPages(options) {
          return simpleTask([{ url: "https://example.com/guide", mention_count: 1 }], options.platform);
        },
        async llmMentionsSearch() {
          throw new Error("not used");
        },
        async llmMentionsAggregatedMetrics() {
          throw new Error("not used");
        },
        async llmMentionsCrossAggregatedMetrics() {
          throw new Error("not used");
        },
        async llmResponseLive() {
          throw new Error("not used");
        },
      }),
      printJsonImpl: (value: unknown) => {
        output = JSON.stringify(value);
      },
    },
  );

  const parsed = JSON.parse(output) as { keywords: Array<{ keyword: string; searchVolumeLastMonth: number; status: string }> };
  assert.equal(parsed.keywords[0]?.keyword, "crm software");
  assert.equal(parsed.keywords[0]?.searchVolumeLastMonth, 42);
  assert.equal(parsed.keywords[0]?.status, "owned");
});

test("runGeoCommand rejects chat_gpt mentions outside US English", async () => {
  await assert.rejects(
    runGeoCommand(
      ["brand-visibility", "--domain", "example.com", "--platform", "chat_gpt", "--location-code", "1000"],
      {
        resolvedConfig: {
          login: "login",
          password: "password",
          baseUrl: "https://api.dataforseo.com",
        },
        createClient: () => {
          throw new Error("should not create client");
        },
      },
    ),
    /chat_gpt` mentions currently support only/,
  );
});

function mentionTask(items: Array<Record<string, unknown>>, platform: string) {
  return {
    id: `search:${platform}`,
    status_code: 20000,
    status_message: "Ok.",
    time: "0.1 sec.",
    cost: 0.01,
    result_count: 1,
    path: ["v3", "ai_optimization", "llm_mentions", "search", "live"],
    data: {},
    result: [{ items }],
  };
}

function simpleTask(items: Array<Record<string, unknown>>, platform = "google") {
  return {
    id: `task:${platform}`,
    status_code: 20000,
    status_message: "Ok.",
    time: "0.1 sec.",
    cost: 0.01,
    result_count: 1,
    path: ["v3", "ai_optimization"],
    data: {},
    result: [{ items }],
  };
}
