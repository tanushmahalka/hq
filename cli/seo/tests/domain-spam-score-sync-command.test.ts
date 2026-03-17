import assert from "node:assert/strict";
import test from "node:test";

import { runDomainSpamScoreCommand } from "../src/commands/domain/spam-score.ts";

test("runDomainSpamScoreCommand supports sync-db dry runs with JSON output", async () => {
  let output = "";

  await runDomainSpamScoreCommand(
    ["sync-db", "--database-url", "postgresql://example", "--dry-run", "--limit", "2", "--json"],
    {
      resolvedConfig: {
        login: "login",
        password: "password",
        baseUrl: "https://api.dataforseo.com",
      },
      createClient: () => ({
        async backlinksBulkSpamScore(options) {
          return {
            id: "bulk-spam-score",
            status_code: 20000,
            status_message: "Ok.",
            time: "0.1 sec.",
            cost: 0.0062,
            result_count: 1,
            path: ["v3", "backlinks", "bulk_spam_score", "live"],
            data: {},
            result: [
              {
                items_count: options.targets.length,
                items: options.targets.map((target, index) => ({ target, spam_score: 20 + index })),
              },
            ],
          };
        },
      }),
      createRepository: async () => ({
        repository: {
          async fetchBatch(options) {
            if (options.afterId === "0") {
              return [
                { id: "1", sourceUrl: "https://alpha.com/post" },
                { id: "2", sourceUrl: "https://beta.com/post" },
              ];
            }

            return [];
          },
          async updateSpamScores() {
            throw new Error("dry run should not write");
          },
        },
        close: async () => {},
      }),
      printJsonImpl: (value: unknown) => {
        output = JSON.stringify(value);
      },
    },
  );

  const parsed = JSON.parse(output) as { summary: { rowsScanned: number; rowsUpdated: number; apiCalls: number } };
  assert.equal(parsed.summary.rowsScanned, 2);
  assert.equal(parsed.summary.rowsUpdated, 2);
  assert.equal(parsed.summary.apiCalls, 1);
});
