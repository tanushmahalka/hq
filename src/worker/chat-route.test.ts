import { beforeEach, describe, expect, it, vi } from "vitest";

const { createContextMock, fetchMock } = vi.hoisted(() => ({
  createContextMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("../../worker/trpc/context.ts", async () => {
  const actual = await vi.importActual<typeof import("../../worker/trpc/context.ts")>(
    "../../worker/trpc/context.ts",
  );

  return {
    ...actual,
    createContext: createContextMock,
  };
});

function createEnv() {
  return {
    DATABASE_URL: "postgres://example.test/hq",
    BETTER_AUTH_SECRET: "secret",
    BETTER_AUTH_URL: "http://localhost:8787",
    HERMES_API_URL: "https://hermes.example.com/v1",
    HERMES_API_KEY: "test-key",
    HERMES_MODEL: "hermes-agent",
  };
}

describe("chat route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createContextMock.mockResolvedValue({
      db: {},
      waitUntil: vi.fn(),
      agentDatabases: new Map(),
      leadAgentId: "lead",
      user: { id: "user-1", email: "user@example.com", name: "Tanush Mahalka" },
      session: { id: "session-1", activeOrganizationId: "org-1" },
      organizationId: "org-1",
      isAgent: false,
    });
    fetchMock.mockResolvedValue(
      new Response('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  it("forwards the custom session key to Hermes as X-Hermes-Session-Id", async () => {
    const { createApp } = await import("../../worker/app.ts");
    const app = createApp({ env: createEnv(), waitUntil: vi.fn() });

    const response = await app.fetch(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sessionKey: "agent:kaira:hq:webchat:user:tanush-mahalka",
          messages: [
            {
              role: "user",
              parts: [{ type: "text", text: "Hello" }],
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hermes.example.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer test-key",
          "content-type": "application/json",
          "X-Hermes-Session-Id": "agent:kaira:hq:webchat:user:tanush-mahalka",
        }),
      }),
    );
  });
});
