import { describe, expect, it } from "vitest";
import { resolveSimpleTaskNotificationAgentId } from "../../worker/trpc/procedures/task.ts";

describe("resolveSimpleTaskNotificationAgentId", () => {
  it("routes agent-created tasks to the assignee session when present", () => {
    expect(
      resolveSimpleTaskNotificationAgentId({
        isAgent: true,
        assignee: "mira-seo",
        leadAgentId: "leo-team-lead",
      }),
    ).toBe("mira-seo");
  });

  it("keeps operator-created tasks on the configured lead session", () => {
    expect(
      resolveSimpleTaskNotificationAgentId({
        isAgent: false,
        assignee: "mira-seo",
        leadAgentId: "leo-team-lead",
      }),
    ).toBe("leo-team-lead");
  });

  it("falls back to the assignee when no valid lead agent is configured", () => {
    expect(
      resolveSimpleTaskNotificationAgentId({
        isAgent: false,
        assignee: "mira-seo",
        leadAgentId: "Unknown",
      }),
    ).toBe("mira-seo");
  });

  it("returns null when neither assignee nor lead agent can be used", () => {
    expect(
      resolveSimpleTaskNotificationAgentId({
        isAgent: true,
        assignee: " ",
        leadAgentId: "Unknown",
      }),
    ).toBeNull();
  });
});
