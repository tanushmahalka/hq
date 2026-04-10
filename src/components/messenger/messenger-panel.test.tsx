import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionMessages } from "./messenger-panel";

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
