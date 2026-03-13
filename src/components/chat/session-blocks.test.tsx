import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionMessageRow } from "./session-blocks";
import type { RawMessage } from "@/hooks/use-chat";

vi.mock("@/hooks/use-admin-view", () => ({
  useAdminView: () => ({
    isAdminView: false,
    setIsAdminView: vi.fn(),
  }),
}));

describe("SessionMessageRow", () => {
  it("renders image-only user messages", () => {
    const message: RawMessage = {
      role: "user",
      timestamp: Date.now(),
      blocks: [
        {
          type: "image",
          dataUrl: "data:image/png;base64,Zm9v",
          mimeType: "image/png",
        },
      ],
    };

    render(<SessionMessageRow msg={message} />);

    expect(screen.getByAltText("Image attachment")).toBeInTheDocument();
  });

  it("renders assistant image blocks alongside text", () => {
    const message: RawMessage = {
      role: "assistant",
      timestamp: Date.now(),
      blocks: [
        { type: "text", text: "Here is the image" },
        {
          type: "image",
          url: "https://example.com/image.png",
          mimeType: "image/png",
        },
      ],
    };

    render(<SessionMessageRow msg={message} />);

    expect(screen.getByText("Here is the image")).toBeInTheDocument();
    expect(screen.getByAltText("Image attachment")).toHaveAttribute(
      "src",
      "https://example.com/image.png"
    );
  });

  it("keeps text cleanup without hiding attached images", () => {
    const message: RawMessage = {
      role: "user",
      timestamp: Date.now(),
      blocks: [
        { type: "text", text: "[Mon 2026-02-23 03:44 UTC] hello" },
        {
          type: "image",
          dataUrl: "data:image/png;base64,Zm9v",
          mimeType: "image/png",
        },
      ],
    };

    render(<SessionMessageRow msg={message} />);

    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(
      screen.queryByText("[Mon 2026-02-23 03:44 UTC] hello")
    ).not.toBeInTheDocument();
    expect(screen.getByAltText("Image attachment")).toBeInTheDocument();
  });

  it("renders omitted image attachments from history metadata", () => {
    const message: RawMessage = {
      role: "user",
      timestamp: Date.now(),
      blocks: [
        {
          type: "image",
          mimeType: "image/jpeg",
          omitted: true,
          bytes: 1291204,
        },
      ],
    };

    render(<SessionMessageRow msg={message} />);

    expect(screen.getByText("Image attachment")).toBeInTheDocument();
    expect(screen.getByText("image/jpeg · 1.2 MB")).toBeInTheDocument();
  });
});
