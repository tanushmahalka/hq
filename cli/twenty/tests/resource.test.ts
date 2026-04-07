import assert from "node:assert/strict";
import test from "node:test";

import { runResourceGroupCommand } from "../src/commands/resources.ts";

test("people list emits JSON by default", async () => {
  process.env.TWENTY_TOKEN = "token";
  process.env.TWENTY_BASE_URL = "https://example.com/rest/";

  let stdout = "";
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += String(chunk);
    return true;
  }) as typeof process.stdout.write;

  try {
    await runResourceGroupCommand("people", ["list"], {
      fetchImpl: async () =>
        new Response(JSON.stringify({ data: { people: [{ id: "1" }] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });
  } finally {
    process.stdout.write = originalWrite;
    delete process.env.TWENTY_TOKEN;
    delete process.env.TWENTY_BASE_URL;
  }

  assert.match(stdout, /"people"/);
});

test("destructive commands require --yes", async () => {
  process.env.TWENTY_TOKEN = "token";
  process.env.TWENTY_BASE_URL = "https://example.com/rest/";

  await assert.rejects(
    () => runResourceGroupCommand("people", ["delete", "--id", "123"], {}),
    /requires --yes/,
  );

  delete process.env.TWENTY_TOKEN;
  delete process.env.TWENTY_BASE_URL;
});
