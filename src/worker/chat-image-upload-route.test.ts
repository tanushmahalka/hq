import { beforeEach, describe, expect, it, vi } from "vitest";

const { createContextMock, uploadChatImageToS3Mock } = vi.hoisted(() => ({
  createContextMock: vi.fn(),
  uploadChatImageToS3Mock: vi.fn(),
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

vi.mock("../../worker/lib/chat-image-upload.ts", async () => {
  const actual = await vi.importActual<typeof import("../../worker/lib/chat-image-upload.ts")>(
    "../../worker/lib/chat-image-upload.ts",
  );

  return {
    ...actual,
    uploadChatImageToS3: uploadChatImageToS3Mock,
  };
});

function createEnv() {
  return {
    DATABASE_URL: "postgres://example.test/hq",
    BETTER_AUTH_SECRET: "secret",
    BETTER_AUTH_URL: "http://localhost:8787",
    S3_BUCKET: "chat-images",
    S3_REGION: "ap-south-1",
    S3_ENDPOINT_URL: "https://t3.storage.dev",
    S3_PUBLIC_BASE_URL: "https://cdn.example.com/chat-images",
    S3_ACCESS_KEY_ID: "key",
    S3_SECRET_ACCESS_KEY: "secret-key",
  };
}

function createImageRequest(options: {
  contents: string;
  fileName: string;
  contentType: string;
}): Request {
  const formData = new FormData();
  formData.set(
    "file",
    new File([options.contents], options.fileName, {
      type: options.contentType,
    }),
  );

  const request = new Request("http://localhost/api/chat/uploads/image", {
    method: "POST",
  });

  Object.defineProperty(request, "formData", {
    value: vi.fn().mockResolvedValue(formData),
  });

  return request;
}

describe("chat image upload route", () => {
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
    uploadChatImageToS3Mock.mockResolvedValue({
      url: "https://cdn.example.com/chat-images/chat-images/2026-03-18/file.png",
      key: "chat-images/2026-03-18/file.png",
      contentType: "image/png",
      size: 4,
    });
  });

  it("rejects unauthorized uploads", async () => {
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
    const response = await app.fetch(
      createImageRequest({
        contents: "test",
        fileName: "demo.png",
        contentType: "image/png",
      }),
    );

    expect(response.status).toBe(401);
    expect(uploadChatImageToS3Mock).not.toHaveBeenCalled();
  });

  it("rejects non-image uploads", async () => {
    const { createApp } = await import("../../worker/app.ts");
    const app = createApp({ env: createEnv(), waitUntil: vi.fn() });
    const response = await app.fetch(
      createImageRequest({
        contents: "%PDF",
        fileName: "demo.pdf",
        contentType: "application/pdf",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: "Only image uploads are supported.",
    });
    expect(uploadChatImageToS3Mock).not.toHaveBeenCalled();
  });

  it("returns the public upload url for authenticated uploads", async () => {
    const { createApp } = await import("../../worker/app.ts");
    const app = createApp({ env: createEnv(), waitUntil: vi.fn() });
    const response = await app.fetch(
      createImageRequest({
        contents: "test",
        fileName: "demo.png",
        contentType: "image/png",
      }),
    );

    expect(response.status).toBe(200);
    expect(uploadChatImageToS3Mock).toHaveBeenCalledWith(
      createEnv(),
      expect.objectContaining({
        name: "demo.png",
        type: "image/png",
        size: 4,
      }),
    );
    expect(await response.json()).toEqual({
      url: "https://cdn.example.com/chat-images/chat-images/2026-03-18/file.png",
      key: "chat-images/2026-03-18/file.png",
      contentType: "image/png",
      size: 4,
    });
  });

  it("surfaces upload helper failures", async () => {
    const { ChatImageUploadError } = await import(
      "../../worker/lib/chat-image-upload.ts"
    );
    uploadChatImageToS3Mock.mockRejectedValue(
      new ChatImageUploadError("Bucket unavailable", 502),
    );

    const { createApp } = await import("../../worker/app.ts");
    const app = createApp({ env: createEnv(), waitUntil: vi.fn() });
    const response = await app.fetch(
      createImageRequest({
        contents: "test",
        fileName: "demo.png",
        contentType: "image/png",
      }),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: "Bucket unavailable" });
  });
});
