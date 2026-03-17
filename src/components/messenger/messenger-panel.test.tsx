import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { MessengerComposer } from "./messenger-panel";
import type { PendingImageAttachment } from "@/hooks/use-chat";
import { uploadChatImage } from "@/lib/chat-image-upload";

vi.mock("@/hooks/use-approvals", () => ({
  useApprovals: () => ({ approvals: [] }),
}));

vi.mock("@/hooks/use-gateway", () => ({
  useGateway: () => ({ connected: true, agents: [] }),
}));

vi.mock("@/hooks/use-messenger-panel", () => ({
  useMessengerPanel: () => ({
    selectedAgentId: "agent-1",
    selectAgent: vi.fn(),
    closeChat: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-agent-activity", () => ({
  useAgentActivity: () => ({ active: false }),
}));

vi.mock("@/lib/chat-image-upload", () => ({
  uploadChatImage: vi.fn(),
}));

class MockFileReader {
  result: string | ArrayBuffer | null = null;
  error: DOMException | null = null;
  private listeners = new Map<string, Array<() => void>>();

  addEventListener(event: string, listener: () => void) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
  }

  readAsDataURL(file: File) {
    this.result = `data:${file.type};base64,${btoa(file.name)}`;
    for (const listener of this.listeners.get("load") ?? []) {
      listener();
    }
  }
}

function ComposerHarness({
  isBusy = false,
  onSend = vi.fn().mockResolvedValue("ignored"),
}: {
  isBusy?: boolean;
  onSend?: (
    text: string,
    attachments: PendingImageAttachment[],
  ) => Promise<"sent" | "queued" | "error" | "ignored">;
}) {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<PendingImageAttachment[]>([]);

  return (
    <MessengerComposer
      connected
      isBusy={isBusy}
      draft={draft}
      onDraftChange={setDraft}
      attachments={attachments}
      onAddAttachments={(next) => setAttachments((prev) => [...prev, ...next])}
      onUpdateAttachment={(attachmentId, patch) =>
        setAttachments((prev) =>
          prev.map((attachment) =>
            attachment.id === attachmentId ? { ...attachment, ...patch } : attachment,
          ),
        )
      }
      onRemoveAttachment={(attachmentId) =>
        setAttachments((prev) =>
          prev.filter((attachment) => attachment.id !== attachmentId),
        )
      }
      onClearAttachments={() => setAttachments([])}
      onSend={onSend}
      onAbort={vi.fn()}
    />
  );
}

describe("MessengerComposer", () => {
  beforeEach(() => {
    vi.stubGlobal("FileReader", MockFileReader);
    vi.mocked(uploadChatImage).mockReset();
    vi.mocked(uploadChatImage).mockResolvedValue({
      url: "https://cdn.example.com/chat-images/demo.png",
      key: "chat-images/demo.png",
      contentType: "image/png",
      size: 12,
    });
  });

  it("adds pasted images as removable previews", async () => {
    render(<ComposerHarness />);

    const textarea = screen.getByPlaceholderText("Message...");
    const file = new File(["image"], "paste.png", { type: "image/png" });

    fireEvent.paste(textarea, {
      clipboardData: {
        files: [file],
      },
    });

    await waitFor(() =>
      expect(screen.getByAltText("Attachment preview")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByLabelText("Remove attachment"));

    await waitFor(() =>
      expect(screen.queryByAltText("Attachment preview")).not.toBeInTheDocument()
    );
  });

  it("supports attachment-only sends from the picker", async () => {
    const onSend = vi.fn<
      (text: string, attachments: PendingImageAttachment[]) => Promise<"sent">
    >().mockResolvedValue("sent");

    const { container } = render(<ComposerHarness onSend={onSend} />);

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    fireEvent.change(input!, {
      target: {
        files: [new File(["image"], "picker.png", { type: "image/png" })],
      },
    });

    await waitFor(() =>
      expect(screen.getByAltText("Attachment preview")).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled()
    );

    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    const [, attachments] = onSend.mock.calls[0] ?? [];
    expect(onSend.mock.calls[0]?.[0]).toBe("");
    expect(attachments).toHaveLength(1);
    expect(attachments?.[0]?.mimeType).toBe("image/png");
    expect(attachments?.[0]?.publicUrl).toBe(
      "https://cdn.example.com/chat-images/demo.png",
    );
  });

  it("keeps Send and shows Stop while busy", () => {
    render(<ComposerHarness isBusy onSend={vi.fn().mockResolvedValue("queued")} />);

    expect(screen.getByText("Send")).toBeInTheDocument();
    expect(screen.getByLabelText("Send message")).toBeInTheDocument();
    expect(screen.getByLabelText("Stop run")).toBeInTheDocument();
  });

  it("shows an upload loader and disables Send until the upload finishes", async () => {
    let resolveUpload:
      | ((value: Awaited<ReturnType<typeof uploadChatImage>>) => void)
      | undefined;
    vi.mocked(uploadChatImage).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );

    const { container } = render(<ComposerHarness />);
    const input = container.querySelector('input[type="file"]');

    fireEvent.change(input!, {
      target: {
        files: [new File(["image"], "uploading.png", { type: "image/png" })],
      },
    });

    await waitFor(() =>
      expect(screen.getByText("Uploading...")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();

    resolveUpload?.({
      url: "https://cdn.example.com/chat-images/uploading.png",
      key: "chat-images/uploading.png",
      contentType: "image/png",
      size: 12,
    });

    await waitFor(() =>
      expect(screen.queryByText("Uploading...")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled();
  });

  it("shows a failed upload state and keeps Send disabled", async () => {
    vi.mocked(uploadChatImage).mockRejectedValue(new Error("Bucket unavailable"));

    const { container } = render(<ComposerHarness />);
    const input = container.querySelector('input[type="file"]');

    fireEvent.change(input!, {
      target: {
        files: [new File(["image"], "broken.png", { type: "image/png" })],
      },
    });

    await waitFor(() =>
      expect(screen.getByText("Upload failed")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });
});
