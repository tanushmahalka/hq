import assert from "node:assert/strict";
import test from "node:test";

import { runBulkDomainSpamScore, runDomainSpamScore } from "../src/providers/dataforseo/domain-spam-score.ts";
import type {
  DataForSeoBacklinksBulkSpamScoreResult,
  DataForSeoBacklinksSpamScoreClient,
  DataForSeoTask,
} from "../src/providers/dataforseo/client.ts";

class FakeBacklinksSpamScoreClient implements DataForSeoBacklinksSpamScoreClient {
  async backlinksBulkSpamScore(): Promise<DataForSeoTask<DataForSeoBacklinksBulkSpamScoreResult>> {
    return {
      id: "bulk-spam-score",
      status_code: 20000,
      status_message: "Ok.",
      time: "0.1 sec.",
      cost: 0.0051,
      result_count: 1,
      path: ["v3", "backlinks", "bulk_spam_score", "live"],
      data: {},
      result: [
        {
          items_count: 1,
          items: [{ target: "www.example.com", spam_score: 7 }],
        },
      ],
    };
  }
}

test("runDomainSpamScore normalizes the domain and returns a machine-friendly report", async () => {
  const report = await runDomainSpamScore(new FakeBacklinksSpamScoreClient(), {
    domain: "https://www.Example.com/path",
  });

  assert.equal(report.summary.domain, "example.com");
  assert.equal(report.summary.spamScore, 7);
  assert.equal(report.summary.totalCostUsd, 0.0051);
  assert.equal(report.result.target, "www.example.com");
  assert.equal(report.tasks.bulkSpamScore.path.join("/"), "v3/backlinks/bulk_spam_score/live");
});

test("runBulkDomainSpamScore batches targets in chunks of 1000", async () => {
  const requestedBatchSizes: number[] = [];
  const domains = Array.from({ length: 1001 }, (_, index) => `example-${index}.com`);

  const report = await runBulkDomainSpamScore(
    {
      async backlinksBulkSpamScore(options) {
        requestedBatchSizes.push(options.targets.length);

        return {
          id: `bulk-spam-score-${requestedBatchSizes.length}`,
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
              items: options.targets.map((target, index) => ({ target, spam_score: index % 100 })),
            },
          ],
        };
      },
    },
    { domains },
  );

  assert.deepEqual(requestedBatchSizes, [1000, 1]);
  assert.equal(report.summary.domainsRequested, 1001);
  assert.equal(report.results.length, 1001);
});
