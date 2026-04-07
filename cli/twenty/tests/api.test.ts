import assert from "node:assert/strict";
import test from "node:test";

import { runApiCommand } from "../src/commands/api.ts";

test("api op supports operation ids and path params", async () => {
  process.env.TWENTY_TOKEN = "token";
  process.env.TWENTY_BASE_URL = "https://example.com/rest/";
  let requestedUrl = "";

  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (() => true) as typeof process.stdout.write;

  try {
    await runApiCommand(["op", "--operation-id", "findOnePerson", "--path-param", "id=abc"], {
      fetchImpl: async (input) => {
        requestedUrl = String(input);
        return new Response(JSON.stringify({ data: { person: { id: "abc" } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
  } finally {
    process.stdout.write = originalWrite;
    delete process.env.TWENTY_TOKEN;
    delete process.env.TWENTY_BASE_URL;
  }

  assert.match(requestedUrl, /\/people\/abc$/);
});
