import assert from "node:assert/strict";
import test from "node:test";

import { runPagesCommand } from "../src/commands/pages.ts";

test("runPagesCommand lists pages in human-readable mode", async () => {
  const lines: string[] = [];

  await runPagesCommand(["list", "--project", "project-123", "--api-key", "token-123"], {
    connectImpl: async () =>
      ({
        async getNodesWithType(type: string) {
          assert.equal(type, "WebPageNode");
          return [
            { id: "page-2", path: "/pricing", getNodesWithType: async () => [] },
            { id: "page-1", path: "/", getNodesWithType: async () => [] },
          ];
        },
        async disconnect() {},
      }) as never,
    printLineImpl: (value = "") => {
      lines.push(value);
    },
  });

  assert.equal(lines[0], "Found 2 page(s)");
  assert.equal(lines[2], "/\tpage-1");
  assert.equal(lines[3], "/pricing\tpage-2");
});
