import assert from "node:assert/strict";
import test from "node:test";

import { runBulkDomainRating, runDomainRating } from "../src/providers/dataforseo/domain-rating.ts";
import type {
  DataForSeoBacklinksBulkRankResult,
  DataForSeoBacklinksClient,
  DataForSeoTask,
} from "../src/providers/dataforseo/client.ts";

class FakeBacklinksClient implements DataForSeoBacklinksClient {
  async backlinksBulkRanks(): Promise<DataForSeoTask<DataForSeoBacklinksBulkRankResult>> {
    return {
      id: "bulk-ranks",
      status_code: 20000,
      status_message: "Ok.",
      time: "0.1 sec.",
      cost: 0.0054,
      result_count: 1,
      path: ["v3", "backlinks", "bulk_ranks", "live"],
      data: {},
      result: [
        {
          items_count: 1,
          items: [{ target: "www.example.com", rank: 742 }],
        },
      ],
    };
  }
}

test("runDomainRating normalizes the domain and returns a machine-friendly report", async () => {
  const report = await runDomainRating(new FakeBacklinksClient(), {
    domain: "https://www.Example.com/path",
    rankScale: "one_thousand",
  });

  assert.equal(report.summary.domain, "example.com");
  assert.equal(report.summary.rating, 742);
  assert.equal(report.summary.rankScale, "one_thousand");
  assert.equal(report.summary.totalCostUsd, 0.0054);
  assert.equal(report.result.target, "www.example.com");
  assert.equal(report.tasks.bulkRanks.path.join("/"), "v3/backlinks/bulk_ranks/live");
});

test("runBulkDomainRating batches targets in chunks of 1000", async () => {
  const requestedBatchSizes: number[] = [];
  const domains = Array.from({ length: 1001 }, (_, index) => `example-${index}.com`);

  const report = await runBulkDomainRating(
    {
      async backlinksBulkRanks(options) {
        requestedBatchSizes.push(options.targets.length);

        return {
          id: `bulk-ranks-${requestedBatchSizes.length}`,
          status_code: 20000,
          status_message: "Ok.",
          time: "0.1 sec.",
          cost: 0.02,
          result_count: 1,
          path: ["v3", "backlinks", "bulk_ranks", "live"],
          data: {},
          result: [
            {
              items_count: options.targets.length,
              items: options.targets.map((target, index) => ({ target, rank: index })),
            },
          ],
        };
      },
    },
    {
      domains,
      rankScale: "one_thousand",
    },
  );

  assert.deepEqual(requestedBatchSizes, [1000, 1]);
  assert.equal(report.summary.domainsRequested, 1001);
  assert.equal(report.results.length, 1001);
});
