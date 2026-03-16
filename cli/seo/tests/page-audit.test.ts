import test from "node:test";
import assert from "node:assert/strict";

import { runPageAudit } from "../src/providers/dataforseo/page-audit.ts";
import type {
  AuditRequestOptions,
  DataForSeoAuditClient,
  DataForSeoTask,
} from "../src/providers/dataforseo/client.ts";

class FakeAuditClient implements DataForSeoAuditClient {
  async auditInstantPage(url: string, _options: AuditRequestOptions): Promise<DataForSeoTask<Record<string, unknown>>> {
    return makeTask(url, "/v3/on_page/instant_pages", 0.0125);
  }
}

test("runPageAudit combines endpoint results into one machine-friendly report", async () => {
  const report = await runPageAudit(new FakeAuditClient(), {
    pages: ["https://example.com", "https://example.com/pricing"],
    device: "desktop",
  });

  assert.equal(report.summary.pagesRequested, 2);
  assert.equal(report.summary.pagesSucceeded, 2);
  assert.equal(report.summary.pagesFailed, 0);
  assert.equal(report.pages.length, 2);
  assert.equal(report.pages[0]?.tasks.instant?.status_code, 20000);
  assert.equal(report.summary.totalCostUsd, 0.025);
});

function makeTask(url: string, endpoint: string, cost: number): DataForSeoTask<Record<string, unknown>> {
  return {
    id: `${endpoint}:${url}`,
    status_code: 20000,
    status_message: "Ok.",
    time: "0.1 sec.",
    cost,
    result_count: 1,
    path: ["v3", ...endpoint.split("/").filter(Boolean)],
    data: { url },
    result: [{ url, endpoint }],
  };
}
