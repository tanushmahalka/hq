import assert from "node:assert/strict";
import test from "node:test";

import { runKeywordsListCommand } from "../src/commands/keywords/list.ts";

test("runKeywordsListCommand renders a tabular keyword list", async () => {
  const lines: string[] = [];

  await runKeywordsListCommand(
    ["--site", "sc-domain:example.com", "--from", "2026-03-01", "--to", "2026-03-07"],
    {
      resolvedConfig: {
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri: "https://app.example.com/callback",
        applicationType: "web",
        scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
      },
      createClient: () => ({
        async listAllQueryKeywords() {
          return {
            siteUrl: "sc-domain:example.com",
            startDate: "2026-03-01",
            endDate: "2026-03-07",
            type: "web",
            dataState: "final",
            totalRows: 2,
            pageCount: 1,
            rows: [
              { query: "alpha", clicks: 5, impressions: 50, ctr: 0.1, position: 4.25 },
              { query: "beta", clicks: 1, impressions: 30, ctr: 0.0333, position: 8.5 },
            ],
          };
        },
      }),
      printLineImpl: (value = "") => {
        lines.push(value);
      },
    },
  );

  assert.equal(lines[0], "Fetched 2 query row(s) for sc-domain:example.com");
  assert.equal(lines[4], "");
  assert.equal(lines[5], "query\tclicks\timpressions\tctr\tposition");
  assert.equal(lines[6], "alpha\t5\t50\t0.1000\t4.25");
  assert.equal(lines[7], "beta\t1\t30\t0.0333\t8.50");
});
