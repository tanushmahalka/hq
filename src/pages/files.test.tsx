import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type FileBrowserEntry = {
  name: string;
  relativePath: string;
  kind: "directory" | "file";
  size: number | null;
  updatedAtMs: number | null;
  mimeType: string | null;
  previewKind: "markdown" | "image" | null;
};

type FileBrowserDirectory = {
  rootLabel: string;
  relativePath: string;
  parentRelativePath: string | null;
  entries: FileBrowserEntry[];
};

const gatewayState = {
  client: {
    request: vi.fn(),
  },
  connected: true,
  snapshot: null,
  agents: [],
  methods: ["file-browser.list", "file-browser.read", "file-browser.download"],
  subscribe: vi.fn(),
};

const directories: Record<string, FileBrowserDirectory> = {
  "": {
    rootLabel: "kfd-brands",
    relativePath: "",
    parentRelativePath: null,
    entries: [
      {
        name: "campaigns",
        relativePath: "campaigns",
        kind: "directory",
        size: null,
        updatedAtMs: 1_710_000_000_000,
        mimeType: null,
        previewKind: null,
      },
      {
        name: "README.md",
        relativePath: "README.md",
        kind: "file",
        size: 18,
        updatedAtMs: 1_710_000_000_000,
        mimeType: "text/markdown",
        previewKind: "markdown",
      },
      {
        name: "preview.png",
        relativePath: "preview.png",
        kind: "file",
        size: 4,
        updatedAtMs: 1_710_000_000_000,
        mimeType: "image/png",
        previewKind: "image",
      },
      {
        name: "archive.zip",
        relativePath: "archive.zip",
        kind: "file",
        size: 400,
        updatedAtMs: 1_710_000_000_000,
        mimeType: "application/zip",
        previewKind: null,
      },
    ],
  },
  campaigns: {
    rootLabel: "kfd-brands",
    relativePath: "campaigns",
    parentRelativePath: "",
    entries: [
      {
        name: "brief.md",
        relativePath: "campaigns/brief.md",
        kind: "file",
        size: 24,
        updatedAtMs: 1_710_000_000_000,
        mimeType: "text/markdown",
        previewKind: "markdown",
      },
    ],
  },
};

vi.mock("@/hooks/use-gateway", () => ({
  useGateway: () => gatewayState,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

function createRequestHandler() {
  return vi.fn(async (method: string, params?: { relativePath?: string; encoding?: string }) => {
    switch (method) {
      case "file-browser.list":
        return directories[params?.relativePath ?? ""];
      case "file-browser.read":
        if (params?.relativePath === "README.md") {
          return {
            file: {
              name: "README.md",
              relativePath: "README.md",
              size: 18,
              updatedAtMs: 1_710_000_000_000,
              mimeType: "text/markdown",
              previewKind: "markdown",
              encoding: "utf8",
              content: "# README\nHello world",
            },
          };
        }
        if (params?.relativePath === "campaigns/brief.md") {
          return {
            file: {
              name: "brief.md",
              relativePath: "campaigns/brief.md",
              size: 24,
              updatedAtMs: 1_710_000_000_000,
              mimeType: "text/markdown",
              previewKind: "markdown",
              encoding: "utf8",
              content: "# Brief\nLaunch plan",
            },
          };
        }
        if (params?.relativePath === "preview.png") {
          return {
            file: {
              name: "preview.png",
              relativePath: "preview.png",
              size: 4,
              updatedAtMs: 1_710_000_000_000,
              mimeType: "image/png",
              previewKind: "image",
              encoding: "base64",
              content: "iVBORw==",
            },
          };
        }
        throw new Error(`unexpected read path: ${params?.relativePath}`);
      case "file-browser.download":
        return {
          name: "download.bin",
          kind: "file",
          mimeType: "application/octet-stream",
          encoding: "base64",
          content: "Zm9v",
        };
      default:
        throw new Error(`unexpected method ${method}`);
    }
  });
}

describe("Files page", () => {
  beforeEach(() => {
    gatewayState.client.request = createRequestHandler();
    gatewayState.connected = true;
    gatewayState.methods = ["file-browser.list", "file-browser.read", "file-browser.download"];
  });

  it("navigates folders via double click and previews markdown files", async () => {
    const { default: Files } = await import("./files");

    render(<Files />);

    await screen.findByText("campaigns");

    const rootMarkdownButton = screen.getByText("README.md").closest("button");
    expect(rootMarkdownButton).not.toBeNull();
    fireEvent.click(rootMarkdownButton!);

    await screen.findByText("Hello world");

    const campaignsButton = screen.getByText("campaigns").closest("button");
    expect(campaignsButton).not.toBeNull();
    fireEvent.doubleClick(campaignsButton!);

    await screen.findByText("brief.md");
    expect(screen.getByRole("button", { name: "campaigns" })).toBeInTheDocument();

    const nestedMarkdownButton = screen.getByText("brief.md").closest("button");
    expect(nestedMarkdownButton).not.toBeNull();
    fireEvent.click(nestedMarkdownButton!);

    await screen.findByText("Launch plan");
  });

  it("renders image previews", async () => {
    const { default: Files } = await import("./files");

    render(<Files />);

    await screen.findByText("preview.png");
    const imageButton = screen.getByText("preview.png").closest("button");
    expect(imageButton).not.toBeNull();
    fireEvent.click(imageButton!);

    const image = await screen.findByAltText("preview.png");
    expect(image).toHaveAttribute("src", "data:image/png;base64,iVBORw==");
  });

  it("shows metadata and download-only state for unsupported file previews", async () => {
    const { default: Files } = await import("./files");

    render(<Files />);

    await screen.findByText("archive.zip");
    const archiveButton = screen.getByText("archive.zip").closest("button");
    expect(archiveButton).not.toBeNull();
    fireEvent.click(archiveButton!);

    await screen.findByText("Preview unavailable for this file type.");
    expect(screen.getAllByText("application/zip")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
  });

  it("shows an unavailable state when the gateway plugin is missing", async () => {
    const { default: Files } = await import("./files");
    gatewayState.methods = [];

    render(<Files />);

    await waitFor(() =>
      expect(
        screen.getByText("Files are not configured on the gateway."),
      ).toBeInTheDocument(),
    );
  });
});
