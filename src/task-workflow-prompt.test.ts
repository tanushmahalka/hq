import { describe, expect, it } from "vitest";
import { buildComplexTaskRootPrompt } from "../worker/lib/task-workflow";

describe("buildComplexTaskRootPrompt", () => {
  it("includes the category label when present", () => {
    const prompt = buildComplexTaskRootPrompt({
      id: "task-1",
      title: "Ship grouped kanban",
      description: "Implement the full task category flow.",
      assignor: "lead",
      assignee: "mira-seo",
      category: "seo",
      campaignId: 3,
    });

    expect(prompt).toContain("Category: SEO");
  });

  it("omits category when the task is uncategorized", () => {
    const prompt = buildComplexTaskRootPrompt({
      id: "task-1",
      title: "Ship grouped kanban",
      description: "Implement the full task category flow.",
      assignor: "lead",
      assignee: "mira-seo",
      category: null,
      campaignId: 3,
    });

    expect(prompt).not.toContain("Category:");
  });
});
