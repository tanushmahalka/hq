// @vitest-environment node

import superjson from "superjson";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHQClient } from "./hq-client";

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe("hq-client", () => {
  it("serializes mutation inputs with superjson and deserializes outputs", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        result: {
          data: superjson.serialize({
            campaignId: 7,
            dueDate: new Date("2026-03-01T00:00:00.000Z"),
          }),
        },
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createHQClient("https://hq.example.com/api/trpc", "token");
    const dueDate = new Date("2026-02-01T00:00:00.000Z");
    const result = await client.call<{ campaignId: number; dueDate: Date }>(
      "task.create",
      { title: "Write brief", dueDate },
      { type: "mutation" }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0]!;
    expect(requestInit?.method).toBe("POST");
    expect(JSON.parse(String(requestInit?.body))).toEqual(
      superjson.serialize({ title: "Write brief", dueDate })
    );
    expect(result.campaignId).toBe(7);
    expect(result.dueDate).toBeInstanceOf(Date);
    expect(result.dueDate.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("serializes query inputs with superjson", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        result: {
          data: superjson.serialize({ ok: true }),
        },
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createHQClient("https://hq.example.com/api/trpc", "token");
    const at = new Date("2026-03-13T09:30:00.000Z");
    await client.call(
      "custom.mission.chain",
      { campaignId: 9, at },
      { type: "query" }
    );

    const [requestUrl] = fetchMock.mock.calls[0]!;
    const input = new URL(String(requestUrl)).searchParams.get("input");
    expect(input).not.toBeNull();
    expect(JSON.parse(input!)).toEqual(
      superjson.serialize({ campaignId: 9, at })
    );
  });
});
