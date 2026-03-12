// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import register from "./index";

type GatewayHandler = (opts: {
  params: Record<string, unknown>;
  respond: (ok: boolean, payload?: unknown, error?: unknown) => void;
}) => Promise<void>;

async function withTempDir(run: (rootDir: string) => Promise<void>) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "file-browser-rpc-"));
  try {
    await run(rootDir);
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
}

function createHandlers(pluginConfig: Record<string, unknown>) {
  const handlers = new Map<string, GatewayHandler>();
  register({
    pluginConfig,
    runtime: {
      config: {
        loadConfig: () => ({}),
      },
    },
    registerGatewayMethod: (method, handler) => {
      handlers.set(method, handler);
    },
  });
  return handlers;
}

async function callHandler(
  handler: GatewayHandler | undefined,
  params: Record<string, unknown> = {},
): Promise<{ ok: boolean; payload?: unknown; error?: unknown }> {
  if (!handler) {
    throw new Error("handler not registered");
  }

  let result: { ok: boolean; payload?: unknown; error?: unknown } | null = null;
  await handler({
    params,
    respond: (ok, payload, error) => {
      result = { ok, payload, error };
    },
  });

  if (!result) {
    throw new Error("handler did not respond");
  }

  return result;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

describe("file-browser-rpc", () => {
  it("lists the root and nested directories with folders first", async () => {
    await withTempDir(async (rootDir) => {
      await fs.mkdir(path.join(rootDir, "campaigns"));
      await fs.mkdir(path.join(rootDir, "campaigns", "q1"));
      await fs.writeFile(path.join(rootDir, "README.md"), "# Hello\n");
      await fs.writeFile(path.join(rootDir, "campaigns", "q1", "brief.md"), "Quarter plan");

      const handlers = createHandlers({ rootPath: rootDir });
      const rootResult = await callHandler(handlers.get("file-browser.list"));
      expect(rootResult.ok).toBe(true);
      expect(rootResult.payload).toMatchObject({
        rootLabel: "kfd-brands",
        relativePath: "",
        parentRelativePath: null,
      });
      expect((rootResult.payload as { entries: Array<{ name: string }> }).entries.map((entry) => entry.name)).toEqual([
        "campaigns",
        "README.md",
      ]);

      const nestedResult = await callHandler(handlers.get("file-browser.list"), {
        relativePath: "campaigns/q1",
      });
      expect(nestedResult.ok).toBe(true);
      expect(nestedResult.payload).toMatchObject({
        relativePath: "campaigns/q1",
        parentRelativePath: "campaigns",
      });
      expect(
        (nestedResult.payload as { entries: Array<{ name: string }> }).entries.map((entry) => entry.name),
      ).toEqual(["brief.md"]);
    });
  });

  it("blocks traversal paths and out-of-root symlink targets", async () => {
    await withTempDir(async (rootDir) => {
      const outsideFile = path.join(os.tmpdir(), `outside-${Date.now()}.md`);
      await fs.writeFile(outsideFile, "outside");
      await fs.symlink(outsideFile, path.join(rootDir, "escape.md"));

      const handlers = createHandlers({ rootPath: rootDir });
      const traversalResult = await callHandler(handlers.get("file-browser.list"), {
        relativePath: "../outside",
      });
      expect(traversalResult.ok).toBe(false);
      expect(getErrorMessage(traversalResult.error)).toContain("escapes");

      const symlinkResult = await callHandler(handlers.get("file-browser.read"), {
        relativePath: "escape.md",
        encoding: "utf8",
      });
      expect(symlinkResult.ok).toBe(false);
      expect(getErrorMessage(symlinkResult.error)).toContain("symlink target escapes");

      await fs.rm(outsideFile, { force: true });
    });
  });

  it("reads markdown as utf8 and images as base64 with preview metadata", async () => {
    await withTempDir(async (rootDir) => {
      await fs.writeFile(path.join(rootDir, "note.md"), "# Title\n");
      await fs.writeFile(path.join(rootDir, "preview.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      const handlers = createHandlers({ rootPath: rootDir });

      const markdownResult = await callHandler(handlers.get("file-browser.read"), {
        relativePath: "note.md",
        encoding: "utf8",
      });
      expect(markdownResult.ok).toBe(true);
      expect(markdownResult.payload).toMatchObject({
        file: {
          name: "note.md",
          previewKind: "markdown",
          encoding: "utf8",
          content: "# Title\n",
        },
      });

      const imageResult = await callHandler(handlers.get("file-browser.read"), {
        relativePath: "preview.png",
        encoding: "base64",
      });
      expect(imageResult.ok).toBe(true);
      expect(imageResult.payload).toMatchObject({
        file: {
          name: "preview.png",
          previewKind: "image",
          mimeType: "image/png",
          encoding: "base64",
        },
      });
      expect((imageResult.payload as { file: { content: string } }).file.content).toBe("iVBORw==");
    });
  });

  it("downloads directories as zip archives", async () => {
    await withTempDir(async (rootDir) => {
      await fs.mkdir(path.join(rootDir, "campaigns", "nested"), { recursive: true });
      await fs.writeFile(path.join(rootDir, "campaigns", "nested", "brief.md"), "zip me");

      const handlers = createHandlers({ rootPath: rootDir });
      const result = await callHandler(handlers.get("file-browser.download"), {
        relativePath: "campaigns",
      });

      expect(result.ok).toBe(true);
      expect(result.payload).toMatchObject({
        name: "campaigns.zip",
        kind: "directory",
        mimeType: "application/zip",
        encoding: "base64",
      });

      const zipBuffer = Buffer.from(
        (result.payload as { content: string }).content,
        "base64",
      );
      expect(zipBuffer.subarray(0, 2).toString("utf8")).toBe("PK");
      expect(zipBuffer.includes(Buffer.from("campaigns/nested/brief.md"))).toBe(true);
    });
  });

  it("enforces preview and download byte limits", async () => {
    await withTempDir(async (rootDir) => {
      await fs.writeFile(path.join(rootDir, "big.md"), "a".repeat(2_048));
      await fs.writeFile(path.join(rootDir, "large.bin"), Buffer.alloc(4_096, 1));

      const handlers = createHandlers({
        rootPath: rootDir,
        previewMaxBytes: 1_024,
        downloadMaxBytes: 1_024,
      });

      const previewResult = await callHandler(handlers.get("file-browser.read"), {
        relativePath: "big.md",
        encoding: "utf8",
      });
      expect(previewResult.ok).toBe(false);
      expect(getErrorMessage(previewResult.error)).toContain("preview limit");

      const downloadResult = await callHandler(handlers.get("file-browser.download"), {
        relativePath: "large.bin",
      });
      expect(downloadResult.ok).toBe(false);
      expect(getErrorMessage(downloadResult.error)).toContain("download limit");
    });
  });
});
