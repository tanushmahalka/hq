import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApprovalsContext, type ApprovalsContextValue } from "@/hooks/use-approvals";

const approvalsValue: ApprovalsContextValue = {
  approvals: [],
  pendingCount: 0,
  approvalsOpen: false,
  setApprovalsOpen: vi.fn(),
  toggleApprovals: vi.fn(),
  resolveApproval: vi.fn(),
  isResolving: vi.fn(() => false),
};

vi.mock("@/hooks/use-task-board-items", () => ({
  useTaskBoardItems: () => ({
    isLoading: false,
    itemsByStatus: {
      todo: [],
      doing: [],
      stuck: [],
      done: [],
    },
  }),
}));

vi.mock("@/components/tasks/automations-column", () => ({
  AutomationsColumn: () => <div>Automations</div>,
}));

vi.mock("@/components/tasks/task-create-dialog", () => ({
  TaskCreateDialog: () => null,
}));

vi.mock("@/components/tasks/task-detail-sheet", () => ({
  TaskDetailSheet: () => null,
}));

vi.mock("@/components/tasks/standalone-approval-sheet", () => ({
  StandaloneApprovalSheet: () => null,
}));

describe("KanbanBoard", () => {
  it("renders the tasks page shell", async () => {
    const { KanbanBoard } = await import("./kanban-board");

    render(
      <ApprovalsContext.Provider value={approvalsValue}>
        <KanbanBoard />
      </ApprovalsContext.Provider>,
    );

    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("Automations")).toBeInTheDocument();
  });
});
