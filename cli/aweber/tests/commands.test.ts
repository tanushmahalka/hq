import assert from "node:assert/strict";
import test from "node:test";

import { runResourceGroupCommand } from "../src/commands/resources.ts";

test("accounts list uses ws pagination and emits JSON", async () => {
  process.env.AWEBER_ACCESS_TOKEN = "test-access-token";
  let output = "";
  let requestCount = 0;

  await runResourceGroupCommand(
    "accounts",
    ["list", "--all", "--ws-size", "2", "--json"],
    {
      fetchImpl: async (input) => {
        requestCount += 1;
        const url = new URL(String(input));
        const start = url.searchParams.get("ws.start") ?? "0";

        return jsonResponse({
          entries: start === "0" ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }],
        });
      },
      printJsonImpl: (value: unknown) => {
        output = JSON.stringify(value);
      },
    },
  );

  const parsed = JSON.parse(output) as { entries: Array<{ id: number }> };
  assert.equal(requestCount, 2);
  assert.deepEqual(parsed.entries.map((entry) => entry.id), [1, 2, 3]);
});

test("subscribers add maps body flags and saved context", async () => {
  process.env.AWEBER_ACCESS_TOKEN = "test-access-token";
  process.env.AWEBER_ACCOUNT_ID = "111";
  process.env.AWEBER_LIST_ID = "222";
  let requestUrl = "";
  let body = "";

  await runResourceGroupCommand(
    "subscribers",
    ["add", "--email", "user@example.com", "--field", "name=Jane Doe", "--json"],
    {
      fetchImpl: async (input, init) => {
        requestUrl = String(input);
        body = String(init?.body);
        return jsonResponse({ id: 5, email: "user@example.com" });
      },
      printJsonImpl: () => {},
    },
  );

  assert.match(requestUrl, /\/accounts\/111\/lists\/222\/subscribers/);
  assert.match(body, /"email":"user@example.com"/);
  assert.match(body, /"name":"Jane Doe"/);
});

test("broadcasts schedule maps representative flags", async () => {
  process.env.AWEBER_ACCESS_TOKEN = "test-access-token";
  process.env.AWEBER_ACCOUNT_ID = "111";
  process.env.AWEBER_LIST_ID = "222";
  let requestUrl = "";
  let body = "";

  await runResourceGroupCommand(
    "broadcasts",
    ["schedule", "--broadcast-id", "555", "--scheduled-for", "2026-03-20T14:30:00Z", "--json"],
    {
      fetchImpl: async (input, init) => {
        requestUrl = String(input);
        body = String(init?.body);
        return jsonResponse({ self_link: "https://api.aweber.com/1.0/accounts/111/lists/222/broadcasts/555" });
      },
      printJsonImpl: () => {},
    },
  );

  assert.match(requestUrl, /\/accounts\/111\/lists\/222\/broadcasts\/555\/schedule/);
  assert.match(body, /scheduled_for=2026-03-20T14%3A30%3A00Z/);
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
