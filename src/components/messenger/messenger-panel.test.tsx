import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SessionInput, SessionMessages } from "./messenger-panel";

vi.mock("@uidotdev/usehooks", () => ({
  useLocalStorage: vi.fn(() => [true, vi.fn()]),
}));

describe("SessionMessages", () => {
  it("renders the live stream text while a response is in flight", () => {
    render(
      <SessionMessages
        approvals={[]}
        messages={[]}
        stream="Hello. Good. Awake and working."
        isBusy
        loading={false}
        error={null}
      />,
    );

    expect(
      screen.getByText("Hello. Good. Awake and working."),
    ).toBeInTheDocument();
  });

  it("does not render a duplicate live preview when the assistant message already exists", () => {
    render(
      <SessionMessages
        approvals={[]}
        messages={[
          {
            role: "assistant",
            timestamp: Date.now(),
            blocks: [
              {
                type: "text",
                text: "Hello. Good. Awake and working.",
              },
            ],
          },
        ]}
        stream="Hello. Good. Awake and working."
        isBusy
        loading={false}
        error={null}
      />,
    );

    expect(
      screen.getAllByText("Hello. Good. Awake and working."),
    ).toHaveLength(1);
  });
});

describe("SessionInput", () => {
  it("clears the draft immediately after Enter sends a valid message", async () => {
    let resolveSend: (value: "sent") => void = () => {};
    const onSend = vi.fn(
      () =>
        new Promise<"sent">((resolve) => {
          resolveSend = resolve;
        }),
    );

    function Harness() {
      const [draft, setDraft] = useState("Hello Kaira");

      return (
        <SessionInput
          ready
          isBusy={false}
          draft={draft}
          onDraftChange={setDraft}
          attachments={[]}
          onAddAttachments={vi.fn()}
          onUpdateAttachment={vi.fn()}
          onRemoveAttachment={vi.fn()}
          onClearAttachments={vi.fn()}
          onSend={onSend}
          onAbort={vi.fn()}
        />
      );
    }

    render(<Harness />);

    const input = screen.getByPlaceholderText("Message Kaira...");
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(input).toHaveValue("");
    });
    expect(onSend).toHaveBeenCalledWith("Hello Kaira", []);

    resolveSend("sent");
  });
});
