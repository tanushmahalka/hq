import assert from "node:assert/strict";
import test from "node:test";

import { syncBacklinkSpamScores } from "../src/providers/dataforseo/backlink-spam-score-sync.ts";

test("syncBacklinkSpamScores batches database reads, caches resolved domains, and updates rows", async () => {
  const fetchedAfterIds: string[] = [];
  const updateBatches: Array<Array<{ id: string; spamScore: number }>> = [];
  const requestedDomains: string[][] = [];
  const progressSnapshots: number[] = [];

  const report = await syncBacklinkSpamScores(
    {
      async fetchBatch(options) {
        fetchedAfterIds.push(options.afterId);

        if (options.afterId === "0") {
          return [
            { id: "1", sourceUrl: "https://www.alpha.com/page-a" },
            { id: "2", sourceUrl: "https://www.alpha.com/page-b" },
            { id: "3", sourceUrl: "https://beta.com/" },
            { id: "4", sourceUrl: "not a url" },
          ];
        }

        if (options.afterId === "4") {
          return [
            { id: "5", sourceUrl: "https://gamma.com/article" },
            { id: "6", sourceUrl: "https://beta.com/pricing" },
          ];
        }

        return [];
      },
      async updateSpamScores(updates) {
        updateBatches.push(updates);
        return updates.length;
      },
    },
    {
      async backlinksBulkSpamScore(options) {
        requestedDomains.push(options.targets);

        return {
          id: `task-${requestedDomains.length}`,
          status_code: 20000,
          status_message: "Ok.",
          time: "0.1 sec.",
          cost: 0.02,
          result_count: 1,
          path: ["v3", "backlinks", "bulk_spam_score", "live"],
          data: {},
          result: [
            {
              items_count: options.targets.length,
              items: options.targets.map((target, index) => ({ target, spam_score: 10 + index })),
            },
          ],
        };
      },
    },
    {
      batchSize: 4,
      fromId: "0",
      force: false,
      dryRun: false,
      onBatchCompleted(progress) {
        progressSnapshots.push(progress.rowsScanned);
      },
    },
  );

  assert.deepEqual(fetchedAfterIds, ["0", "4", "6"]);
  assert.deepEqual(requestedDomains, [["alpha.com", "beta.com"], ["gamma.com"]]);
  assert.deepEqual(progressSnapshots, [4, 6]);
  assert.deepEqual(updateBatches, [
    [
      { id: "1", spamScore: 10 },
      { id: "2", spamScore: 10 },
      { id: "3", spamScore: 11 },
    ],
    [
      { id: "5", spamScore: 10 },
      { id: "6", spamScore: 11 },
    ],
  ]);
  assert.equal(report.summary.rowsScanned, 6);
  assert.equal(report.summary.rowsUpdated, 5);
  assert.equal(report.summary.rowsSkipped, 1);
  assert.equal(report.summary.apiCalls, 2);
  assert.equal(report.summary.uniqueDomainsResolved, 3);
  assert.equal(report.summary.lastProcessedId, "6");
});
