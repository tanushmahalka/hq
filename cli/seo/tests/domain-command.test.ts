import assert from "node:assert/strict";
import test from "node:test";

import { runDomainRatingCommand } from "../src/commands/domain/rating.ts";
import { runDomainSpamScoreCommand } from "../src/commands/domain/spam-score.ts";

test("runDomainRatingCommand renders a human-readable domain rating summary", async () => {
  const lines: string[] = [];

  await runDomainRatingCommand(
    ["--domain", "https://www.example.com", "--scale", "100"],
    {
      resolvedConfig: {
        login: "login",
        password: "password",
        baseUrl: "https://api.dataforseo.com",
      },
      createClient: () => ({
        async backlinksBulkRanks() {
          return {
            id: "bulk-ranks",
            status_code: 20000,
            status_message: "Ok.",
            time: "0.1 sec.",
            cost: 0.0061,
            result_count: 1,
            path: ["v3", "backlinks", "bulk_ranks", "live"],
            data: {},
            result: [
              {
                items_count: 1,
                items: [{ target: "example.com", rank: 74 }],
              },
            ],
          };
        },
      }),
      printLineImpl: (value = "") => {
        lines.push(value);
      },
    },
  );

  assert.equal(lines[0], "Domain rating for example.com");
  assert.equal(lines[1], "Rating: 74");
  assert.equal(lines[2], "Scale: 0-100");
  assert.equal(lines[3], "Estimated API cost: $0.006100");
});

test("runDomainRatingCommand reads domains from a file and renders a table", async () => {
  const lines: string[] = [];

  await runDomainRatingCommand(
    ["--file", "domains.txt"],
    {
      resolvedConfig: {
        login: "login",
        password: "password",
        baseUrl: "https://api.dataforseo.com",
      },
      createClient: () => ({
        async backlinksBulkRanks(options) {
          return {
            id: "bulk-ranks",
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
                items: options.targets.map((target, index) => ({ target, rank: 100 + index })),
              },
            ],
          };
        },
      }),
      readFileImpl: async () => "example.com\nhttps://www.test.com/path\n",
      printLineImpl: (value = "") => {
        lines.push(value);
      },
    },
  );

  assert.equal(lines[0], "Domain ratings for 2 target(s)");
  assert.equal(lines[1], "Scale: 0-1000");
  assert.equal(lines[3], "");
  assert.equal(lines[4], "domain\trating");
  assert.equal(lines[5], "example.com\t100");
  assert.equal(lines[6], "test.com\t101");
});

test("runDomainRatingCommand emits normalized JSON when requested", async () => {
  let output = "";

  await runDomainRatingCommand(
    ["--domain", "example.com", "--json"],
    {
      resolvedConfig: {
        login: "login",
        password: "password",
        baseUrl: "https://api.dataforseo.com",
      },
      createClient: () => ({
        async backlinksBulkRanks() {
          return {
            id: "bulk-ranks",
            status_code: 20000,
            status_message: "Ok.",
            time: "0.1 sec.",
            cost: 0.0049,
            result_count: 1,
            path: ["v3", "backlinks", "bulk_ranks", "live"],
            data: {},
            result: [
              {
                items_count: 1,
                items: [{ target: "example.com", rank: 611 }],
              },
            ],
          };
        },
      }),
      printJsonImpl: (value: unknown) => {
        output = JSON.stringify(value);
      },
    },
  );

  const parsed = JSON.parse(output) as {
    summary: { domainsRequested: number; rankScale: string };
    results: Array<{ domain: string; rating: number }>;
  };
  assert.equal(parsed.summary.domainsRequested, 1);
  assert.equal(parsed.summary.rankScale, "one_thousand");
  assert.equal(parsed.results[0]?.domain, "example.com");
  assert.equal(parsed.results[0]?.rating, 611);
});

test("runDomainSpamScoreCommand renders a human-readable spam score summary", async () => {
  const lines: string[] = [];

  await runDomainSpamScoreCommand(
    ["--domain", "https://www.example.com"],
    {
      resolvedConfig: {
        login: "login",
        password: "password",
        baseUrl: "https://api.dataforseo.com",
      },
      createClient: () => ({
        async backlinksBulkSpamScore() {
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
                items_count: 1,
                items: [{ target: "example.com", spam_score: 8 }],
              },
            ],
          };
        },
      }),
      printLineImpl: (value = "") => {
        lines.push(value);
      },
    },
  );

  assert.equal(lines[0], "Domain spam score for example.com");
  assert.equal(lines[1], "Spam score: 8");
  assert.equal(lines[2], "Estimated API cost: $0.006200");
});
