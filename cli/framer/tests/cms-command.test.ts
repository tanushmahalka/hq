import assert from "node:assert/strict";
import test from "node:test";

import { runCmsCommand } from "../src/commands/cms.ts";

test("runCmsCommand updates a CMS item field with typed data", async () => {
  const seenUpdates: unknown[] = [];

  const item = {
    id: "item-1",
    slug: "launch-post",
    draft: false,
    fieldData: {},
    async setAttributes(attributes: Record<string, unknown>) {
      seenUpdates.push(attributes);
      return {
        ...this,
        fieldData: {
          title: {
            type: "string",
            value: "Spring Launch",
          },
        },
      };
    },
  };

  await runCmsCommand(
    [
      "update",
      "--collection",
      "Posts",
      "--item",
      "launch-post",
      "--field",
      "Title",
      "--value",
      "Spring Launch",
      "--project",
      "project-123",
      "--api-key",
      "token-123",
    ],
    {
      connectImpl: async () =>
        ({
          async getCollections() {
            return [
              {
                id: "collection-1",
                name: "Posts",
                managedBy: "user",
                async getFields() {
                  return [{ id: "title", name: "Title", type: "string" }];
                },
                async getItems() {
                  return [item];
                },
              },
            ];
          },
          async disconnect() {},
        }) as never,
    },
  );

  assert.deepEqual(seenUpdates, [
    {
      draft: false,
      fieldData: {
        title: {
          type: "string",
          value: "Spring Launch",
        },
      },
    },
  ]);
});
