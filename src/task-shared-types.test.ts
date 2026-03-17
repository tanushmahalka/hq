import { describe, expect, it } from "vitest";
import {
  TASK_CATEGORIES,
  TASK_CATEGORY_LABELS,
  TASK_STATUSES,
  STATUS_LABELS,
} from "@shared/types";

describe("task shared types", () => {
  it("defines the supported task categories and labels", () => {
    expect(TASK_CATEGORIES).toEqual(["seo", "marketing"]);
    expect(TASK_CATEGORY_LABELS).toEqual({
      seo: "SEO",
      marketing: "Marketing",
    });
  });

  it("keeps task status labels aligned", () => {
    expect(TASK_STATUSES).toEqual(["todo", "doing", "stuck", "done"]);
    expect(STATUS_LABELS.done).toBe("Done");
  });
});
