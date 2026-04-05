import assert from "node:assert/strict";
import test from "node:test";

import { runCmsCommand } from "../src/commands/cms.ts";
import { CliError } from "../src/core/errors.ts";

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
      fieldData: {
        title: {
          type: "string",
          value: "Spring Launch",
        },
      },
    },
  ]);
});

test("runCmsCommand supports limiting items to zero", async () => {
  let payload: unknown;

  await runCmsCommand(
    ["items", "--collection", "Posts", "--limit", "0", "--json", "--project", "project-123", "--api-key", "token-123"],
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
                  return [
                    {
                      id: "item-1",
                      slug: "launch-post",
                      draft: false,
                      fieldData: {},
                      async setAttributes() {
                        return this;
                      },
                    },
                  ];
                },
              },
            ];
          },
          async disconnect() {},
        }) as never,
      printJsonImpl: (value: unknown) => {
        payload = value;
      },
    },
  );

  assert.deepEqual(payload, {
    collection: {
      id: "collection-1",
      managedBy: "user",
      name: "Posts",
      readonly: null,
    },
    fields: [{ id: "title", name: "Title", type: "string" }],
    items: [],
  });
});

test("runCmsCommand rejects negative limits", async () => {
  await assert.rejects(
    () =>
      runCmsCommand(["items", "--collection", "Posts", "--limit", "-1", "--project", "project-123", "--api-key", "token-123"], {
        connectImpl: async () =>
          ({
            async getCollections() {
              return [
                {
                  id: "collection-1",
                  name: "Posts",
                  managedBy: "user",
                  async getFields() {
                    return [];
                  },
                  async getItems() {
                    return [];
                  },
                },
              ];
            },
            async disconnect() {},
          }) as never,
      }),
    (error: unknown) => {
      assert.ok(error instanceof CliError);
      assert.match(error.message, /non-negative integer/);
      return true;
    },
  );
});
