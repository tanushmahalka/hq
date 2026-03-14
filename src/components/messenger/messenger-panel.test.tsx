import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessengerComposer } from "./messenger-panel";
import type { PendingImageAttachment } from "@/hooks/use-chat";

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

describe("MessengerComposer", () => {
  beforeEach(() => {
    vi.stubGlobal("FileReader", MockFileReader);
  });

  it("adds pasted images as removable previews", async () => {
    render(
      <MessengerComposer
        connected
        isBusy={false}
        onSend={vi.fn().mockResolvedValue("ignored")}
        onAbort={vi.fn()}
      />
    );

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

    const { container } = render(
      <MessengerComposer
        connected
        isBusy={false}
        onSend={onSend}
        onAbort={vi.fn()}
      />
    );

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

    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    const [, attachments] = onSend.mock.calls[0] ?? [];
    expect(onSend.mock.calls[0]?.[0]).toBe("");
    expect(attachments).toHaveLength(1);
    expect(attachments?.[0]?.mimeType).toBe("image/png");
  });

  it("keeps Send and shows Stop while busy", () => {
    render(
      <MessengerComposer
        connected
        isBusy
        onSend={vi.fn().mockResolvedValue("queued")}
        onAbort={vi.fn()}
      />
    );

    expect(screen.getByText("Send")).toBeInTheDocument();
    expect(screen.getByLabelText("Send message")).toBeInTheDocument();
    expect(screen.getByLabelText("Stop run")).toBeInTheDocument();
  });
});
