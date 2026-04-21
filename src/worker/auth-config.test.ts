import { describe, expect, it, vi } from "vitest";

const betterAuthMock = vi.fn((options) => options);

vi.mock("better-auth", () => ({
  betterAuth: betterAuthMock,
}));

vi.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: vi.fn(() => ({ mocked: true })),
}));

vi.mock("better-auth/plugins", () => ({
  organization: vi.fn((options) => ({ name: "organization", options })),
  admin: vi.fn((options) => ({ name: "admin", options })),
}));

describe("createAuth", () => {
  it("configures long-lived persistent sessions", async () => {
    const authModule = await import("../../worker/lib/auth.ts");
    const { createAuth } = authModule;

    const db = {
      query: {
        invitation: {
          findFirst: vi.fn(),
        },
      },
      update: vi.fn(),
    } as unknown as Parameters<typeof createAuth>[0];

    createAuth(db, {
      secret: "test-secret",
      baseURL: "http://localhost:8787",
    });

    expect(betterAuthMock).toHaveBeenCalledTimes(1);
    const options = betterAuthMock.mock.calls[0]?.[0];

    expect(options.session).toMatchObject({
      expiresIn: authModule.PERSISTENT_SESSION_DURATION_SECONDS,
      updateAge: authModule.SESSION_REFRESH_INTERVAL_SECONDS,
      cookieCache: {
        enabled: true,
        maxAge: authModule.SESSION_COOKIE_CACHE_MAX_AGE_SECONDS,
      },
    });
  });
});
