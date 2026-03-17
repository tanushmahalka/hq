import assert from "node:assert/strict";
import test from "node:test";

import { loadDomainTargets, parseDomainTargetFile } from "../src/commands/domain/input.ts";

test("parseDomainTargetFile supports newline-delimited domain lists", () => {
  const result = parseDomainTargetFile(`
    # batch one
    example.com
    https://www.test.com/path
  `);

  assert.deepEqual(result, ["example.com", "https://www.test.com/path"]);
});

test("loadDomainTargets supports JSON arrays and normalizes domains", async () => {
  const result = await loadDomainTargets({
    domains: [],
    file: "domains.json",
    readFileImpl: async () => '["https://www.Example.com/path", "test.com", "example.com"]',
  });

  assert.deepEqual(result, ["example.com", "test.com"]);
});
