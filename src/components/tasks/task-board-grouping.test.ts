import { describe, expect, it } from "vitest";
import type { TaskBoardItemUnion } from "@/hooks/use-approvals";
import { groupBoardItemsByCategory } from "./task-board-grouping";

function createEmptyStatusBuckets(): Record<
  "todo" | "doing" | "stuck" | "done",
  TaskBoardItemUnion[]
> {
  return {
    todo: [],
    doing: [],
    stuck: [],
    done: [],
  };
}

function createTaskItem(
  id: string,
  status: "todo" | "doing" | "stuck" | "done",
  category: "seo" | "marketing" | null,
): TaskBoardItemUnion {
  return {
    kind: "task",
    id,
    displayStatus: status,
    task: {
      id,
      title: `Task ${id}`,
      description: null,
      status,
      category,
      assignee: null,
      dueDate: null,
      urgent: false,
      important: false,
      createdAt: null,
    },
  };
}

function createStandaloneApproval(id: string): TaskBoardItemUnion {
  return {
    kind: "standalone-approval",
    id,
    displayStatus: "stuck",
    approval: {
      id,
      request: {
        title: `Approval ${id}`,
        body: "Needs review",
        sessionKey: "agent:lead:approval",
      },
      createdAtMs: 1,
    },
  };
}

describe("groupBoardItemsByCategory", () => {
  it("returns groups in SEO, Marketing, Uncategorised order", () => {
    const buckets = createEmptyStatusBuckets();
    buckets.todo.push(createTaskItem("seo-1", "todo", "seo"));
    buckets.doing.push(createTaskItem("marketing-1", "doing", "marketing"));
    buckets.stuck.push(createTaskItem("uncat-1", "stuck", null));

    const groups = groupBoardItemsByCategory(buckets);

    expect(groups.map((group) => group.label)).toEqual([
      "SEO",
      "Marketing",
      "Uncategorised",
    ]);
  });

  it("routes uncategorized tasks and standalone approvals into the fallback group", () => {
    const buckets = createEmptyStatusBuckets();
    buckets.todo.push(createTaskItem("uncat-1", "todo", null));
    buckets.stuck.push(createStandaloneApproval("approval-1"));

    const groups = groupBoardItemsByCategory(buckets);
    const uncategorized = groups.find((group) => group.key === "uncategorized");

    expect(uncategorized?.itemsByStatus.todo).toHaveLength(1);
    expect(uncategorized?.itemsByStatus.stuck).toHaveLength(1);
    expect(uncategorized?.itemsByStatus.stuck[0]?.kind).toBe("standalone-approval");
  });

  it("hides empty category groups", () => {
    const buckets = createEmptyStatusBuckets();
    buckets.done.push(createTaskItem("seo-1", "done", "seo"));

    const groups = groupBoardItemsByCategory(buckets);

    expect(groups.map((group) => group.key)).toEqual(["seo"]);
  });
});
