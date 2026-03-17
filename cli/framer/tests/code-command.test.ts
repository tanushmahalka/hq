import assert from "node:assert/strict";
import test from "node:test";

import { runCodeCommand } from "../src/commands/code.ts";

test("runCodeCommand updates a code file by path", async () => {
  const seenContent: string[] = [];

  await runCodeCommand(
    ["set", "--file", "components/Hero.tsx", "--content", "export const x = 1;", "--project", "project-123", "--api-key", "token-123"],
    {
    connectImpl: async () =>
      ({
        async getCodeFiles() {
          return [
            {
              id: "file-1",
              name: "Hero.tsx",
              path: "components/Hero.tsx",
              content: "export const x = 0;",
              exports: [],
              versionId: "v1",
              async setFileContent(content: string) {
                seenContent.push(content);
                return {
                  ...this,
                  content,
                  versionId: "v2",
                };
              },
            },
          ];
        },
        async disconnect() {},
      }) as never,
    },
  );

  assert.deepEqual(seenContent, ["export const x = 1;"]);
});
