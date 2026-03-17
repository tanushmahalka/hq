import { beforeEach, describe, expect, it, vi } from "vitest";

const createContextMock = vi.fn();
const getMarketingAssetMock = vi.fn();
const renderMarketingAssetPdfMock = vi.fn();
const buildMarketingAssetPdfFilenameMock = vi.fn();

vi.mock("../../worker/trpc/context.ts", async () => {
  const actual = await vi.importActual<typeof import("../../worker/trpc/context.ts")>(
    "../../worker/trpc/context.ts",
  );

  return {
    ...actual,
    createContext: createContextMock,
  };
});

vi.mock("../../worker/lib/marketing-asset.ts", async () => {
  const actual = await vi.importActual<typeof import("../../worker/lib/marketing-asset.ts")>(
    "../../worker/lib/marketing-asset.ts",
  );

  return {
    ...actual,
    getMarketingAsset: getMarketingAssetMock,
  };
});

vi.mock("../../worker/lib/marketing-asset-pdf.ts", async () => {
  const actual = await vi.importActual<typeof import("../../worker/lib/marketing-asset-pdf.ts")>(
    "../../worker/lib/marketing-asset-pdf.ts",
  );

  return {
    ...actual,
    renderMarketingAssetPdf: renderMarketingAssetPdfMock,
    buildMarketingAssetPdfFilename: buildMarketingAssetPdfFilenameMock,
  };
});

function createEnv() {
  return {
    DATABASE_URL: "postgres://example.test/hq",
    BETTER_AUTH_SECRET: "secret",
    BETTER_AUTH_URL: "http://localhost:8787",
  };
}

describe("marketing asset pdf route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createContextMock.mockResolvedValue({
      db: {},
      waitUntil: vi.fn(),
      agentDatabases: new Map(),
      leadAgentId: "lead",
      user: { id: "user-1", email: "user@example.com", name: "User" },
      session: { id: "session-1", activeOrganizationId: "org-1" },
      organizationId: "org-1",
      isAgent: false,
    });
    buildMarketingAssetPdfFilenameMock.mockReturnValue("weekly-brief.pdf");
  });

  it("rejects unauthorized requests", async () => {
    createContextMock.mockResolvedValue({
      db: {},
      waitUntil: vi.fn(),
      agentDatabases: new Map(),
      leadAgentId: "lead",
      user: null,
      session: null,
      organizationId: null,
      isAgent: false,
    });

    const { createApp } = await import("../../worker/app.ts");
    const app = createApp({ env: createEnv(), waitUntil: vi.fn() });
    const response = await app.request("/api/marketing/assets/12/pdf");

    expect(response.status).toBe(401);
  });

  it("returns not found when the asset does not exist", async () => {
    getMarketingAssetMock.mockResolvedValue(null);

    const { createApp } = await import("../../worker/app.ts");
    const app = createApp({ env: createEnv(), waitUntil: vi.fn() });
    const response = await app.request("/api/marketing/assets/12/pdf");

    expect(response.status).toBe(404);
    expect(getMarketingAssetMock).toHaveBeenCalledWith({}, 12, "org-1");
  });

  it("returns a downloadable pdf response with attachment headers", async () => {
    getMarketingAssetMock.mockResolvedValue({
      id: 12,
      slug: "weekly-brief",
      currentHtml: "<html><body>Brief</body></html>",
    });
    renderMarketingAssetPdfMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { createApp } = await import("../../worker/app.ts");
    const app = createApp({ env: createEnv(), waitUntil: vi.fn() });
    const response = await app.request("/api/marketing/assets/12/pdf");

    expect(response.status).toBe(200);
    expect(renderMarketingAssetPdfMock).toHaveBeenCalledWith(
      "<html><body>Brief</body></html>",
    );
    expect(buildMarketingAssetPdfFilenameMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 12, slug: "weekly-brief" }),
    );
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="weekly-brief.pdf"',
    );
    expect(response.headers.get("cache-control")).toBe(
      "no-store, no-cache, must-revalidate",
    );
  });
});
