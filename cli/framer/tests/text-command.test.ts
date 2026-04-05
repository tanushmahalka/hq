import assert from "node:assert/strict";
import test from "node:test";

import { runTextCommand } from "../src/commands/text.ts";

test("runTextCommand updates a text node resolved by page and name", async () => {
  const updates: string[] = [];

  const titleNode = {
    id: "text-1",
    name: "hero-title",
    async getText() {
      return "Before";
    },
    async setText(value: string) {
      updates.push(value);
    },
  };

  await runTextCommand(
    ["set", "--page", "/pricing", "--name", "hero-title", "--value", "After", "--project", "project-123", "--api-key", "token-123"],
    {
    connectImpl: async () =>
      ({
        async getNode() {
          return null;
        },
        async getNodesWithType(type: string) {
          assert.equal(type, "WebPageNode");
          return [
            {
              id: "page-1",
              path: "/pricing",
              async getNodesWithType(innerType: string) {
                assert.equal(innerType, "TextNode");
                return [titleNode];
              },
            },
          ];
        },
        async disconnect() {},
      }) as never,
    },
  );

  assert.deepEqual(updates, ["After"]);
});

test("runTextCommand prints help without requiring Framer credentials", async () => {
  const lines: string[] = [];

  await runTextCommand(["help"], {
    printLineImpl: (value = "") => {
      lines.push(value);
    },
  });

  assert.match(lines.join("\n"), /framer text get --node <id>/);
});
