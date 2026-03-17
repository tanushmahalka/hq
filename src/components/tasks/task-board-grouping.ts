import {
  TASK_CATEGORIES,
  TASK_CATEGORY_LABELS,
  TASK_STATUSES,
  type TaskCategory,
  type TaskStatus,
} from "@shared/types";
import type { TaskBoardItemUnion } from "@/hooks/use-approvals";

export type TaskCategoryGroupKey = TaskCategory | "uncategorized";

export type TaskCategoryGroup = {
  key: TaskCategoryGroupKey;
  label: string;
  itemsByStatus: Record<TaskStatus, TaskBoardItemUnion[]>;
  totalItems: number;
};

function createEmptyBuckets(): Record<TaskStatus, TaskBoardItemUnion[]> {
  return TASK_STATUSES.reduce(
    (acc, status) => {
      acc[status] = [];
      return acc;
    },
    {} as Record<TaskStatus, TaskBoardItemUnion[]>,
  );
}

function getGroupLabel(key: TaskCategoryGroupKey): string {
  return key === "uncategorized" ? "Uncategorised" : TASK_CATEGORY_LABELS[key];
}

function getGroupKey(item: TaskBoardItemUnion): TaskCategoryGroupKey {
  if (item.kind !== "task") {
    return "uncategorized";
  }
  return item.task.category ?? "uncategorized";
}

export function groupBoardItemsByCategory(
  itemsByStatus: Record<TaskStatus, TaskBoardItemUnion[]>,
): TaskCategoryGroup[] {
  const order: TaskCategoryGroupKey[] = [...TASK_CATEGORIES, "uncategorized"];
  const groups = new Map<TaskCategoryGroupKey, TaskCategoryGroup>(
    order.map((key) => [
      key,
      {
        key,
        label: getGroupLabel(key),
        itemsByStatus: createEmptyBuckets(),
        totalItems: 0,
      },
    ]),
  );

  for (const status of TASK_STATUSES) {
    for (const item of itemsByStatus[status]) {
      const key = getGroupKey(item);
      const group = groups.get(key);
      if (!group) {
        continue;
      }
      group.itemsByStatus[status].push(item);
      group.totalItems += 1;
    }
  }

  return order
    .map((key) => groups.get(key)!)
    .filter((group) => group.totalItems > 0);
}
