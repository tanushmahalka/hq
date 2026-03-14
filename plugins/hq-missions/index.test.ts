// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const callMock = vi.fn();
const fetchMissionChainMock = vi.fn();

vi.mock("@sinclair/typebox", () => ({
  Type: {
    Object: (value: unknown) => value,
    Optional: (value: unknown) => value,
    Union: (value: unknown) => value,
    Array: (value: unknown) => value,
    Literal: (value: unknown) => value,
    String: (value: unknown) => value,
    Number: (value: unknown) => value,
    Boolean: (value: unknown) => value,
    Null: () => ({ type: "null" }),
  },
}));

vi.mock("./hq-client", () => ({
  createHQClient: vi.fn(() => ({
    call: callMock,
    fetchMissionChain: fetchMissionChainMock,
  })),
}));

import register from "./index";

type ToolDef = {
  name: string;
  execute: (
    id: string,
    params: Record<string, unknown>
  ) => Promise<{ content: { type: string; text: string }[] }>;
};

type HookHandler = (
  ctx: {
    prompt: string;
    messages: unknown[];
  },
  meta: {
    agentId?: string;
    sessionKey?: string;
  }
) => Promise<{ prependSystemContext?: string } | void>;

function createPlugin() {
  const tools = new Map<string, ToolDef>();
  const hooks = new Map<string, HookHandler>();

  register({
    config: {
      hqApiUrl: "https://hq.example.com/api/trpc",
      hqApiToken: "token",
    },
    registerTool: (def) => {
      tools.set(def.name, def as ToolDef);
    },
    registerGatewayMethod: () => {},
    on: (event, handler) => {
      hooks.set(event, handler as HookHandler);
    },
  });

  return { tools, hooks };
}

beforeEach(() => {
  callMock.mockReset();
  fetchMissionChainMock.mockReset();
});

describe("hq-missions plugin", () => {
  it("coerces campaign ids and forwards workflowMode for task create and update", async () => {
    const { tools } = createPlugin();
    callMock.mockResolvedValue({ id: "task-1" });

    await tools.get("create_task")!.execute("1", {
      title: "Write brief",
      campaignId: "42",
      workflowMode: "complex",
    });
    expect(callMock).toHaveBeenNthCalledWith(
      1,
      "task.create",
      expect.objectContaining({
        title: "Write brief",
        campaignId: 42,
        workflowMode: "complex",
      })
    );

    await tools.get("update_task")!.execute("1", {
      taskId: "task-1",
      campaignId: "99",
      workflowMode: "simple",
    });
    expect(callMock).toHaveBeenNthCalledWith(2, "task.update", {
      id: "task-1",
      campaignId: 99,
      workflowMode: "simple",
    });
  });

  it("coerces numeric comment ids before deleting task comments", async () => {
    const { tools } = createPlugin();
    callMock.mockResolvedValue({ success: true });

    await tools.get("delete_task_comment")!.execute("1", {
      commentId: "17",
    });

    expect(callMock).toHaveBeenCalledWith("task.comment.delete", { id: 17 });
  });

  it("coerces workflow tool payloads", async () => {
    const { tools } = createPlugin();
    callMock.mockResolvedValue({ ok: true });

    await tools.get("update_task_subtask")!.execute("1", {
      taskId: "task-1",
      subtaskId: "7",
      status: "done",
    });
    expect(callMock).toHaveBeenNthCalledWith(1, "task.workflow.updateSubtask", {
      taskId: "task-1",
      subtaskId: 7,
      status: "done",
      latestWorkerSummary: undefined,
      latestValidatorSummary: undefined,
      latestFeedback: undefined,
    });

    await tools.get("link_task_session")!.execute("2", {
      taskId: "task-1",
      sessionKey: "agent:worker:subagent:abc",
      role: "worker",
      subtaskId: "7",
      startedAtIso: "2026-03-13T09:00:00.000Z",
    });
    expect(callMock).toHaveBeenNthCalledWith(2, "task.workflow.linkSession", {
      taskId: "task-1",
      sessionKey: "agent:worker:subagent:abc",
      role: "worker",
      subtaskId: 7,
      agentId: undefined,
      parentSessionKey: undefined,
      startedAt: new Date("2026-03-13T09:00:00.000Z"),
      completedAt: undefined,
      endedAt: undefined,
    });
  });

  it("injects complex workflow context during before_prompt_build", async () => {
    const { hooks } = createPlugin();
    callMock.mockResolvedValue({
      task: {
        id: "task-1",
        title: "Complex task",
        description: "Ship the workflow",
        status: "doing",
        workflowMode: "complex",
        assignor: "lead",
        assignee: "agent-1",
        campaignId: 3,
      },
      workflow: {
        status: "planning",
        planPath: ".openclaw/tasks/task-1/plan.md",
        planSummary: "Plan summary",
      },
      subtasks: [
        {
          id: 11,
          position: 1,
          title: "Implement data model",
          instructions: "Add tables and enums",
          acceptanceCriteria: "Schema and API compile",
          status: "running",
          latestWorkerSummary: null,
          latestValidatorSummary: null,
          latestFeedback: null,
        },
      ],
      sessions: [
        {
          id: 1,
          sessionKey: "agent:agent-1:task:task-1",
          role: "root",
          subtaskId: null,
          agentId: "agent-1",
          parentSessionKey: null,
          startedAt: null,
          completedAt: null,
          endedAt: null,
        },
      ],
      summary: {
        mode: "complex",
        status: "planning",
        planPath: ".openclaw/tasks/task-1/plan.md",
        planSummary: "Plan summary",
        totalSubtasks: 1,
        completedSubtasks: 0,
        activeSubtaskId: 11,
        blockedSubtaskId: null,
        rootAgentId: "agent-1",
        sessionKeys: ["agent:agent-1:task:task-1"],
      },
    });
    fetchMissionChainMock.mockResolvedValue({
      mission: {
        id: 1,
        agentId: "agent-1",
        title: "Mission",
        description: null,
        status: "active",
      },
      objective: {
        id: 2,
        title: "Objective",
        description: null,
        targetMetric: "traffic",
        targetValue: "100",
        currentValue: "50",
        status: "active",
        dueDate: new Date("2026-03-20T00:00:00.000Z"),
      },
      campaign: {
        id: 3,
        title: "Campaign",
        description: null,
        hypothesis: "A test hypothesis",
        learnings: null,
        status: "active",
      },
    });

    const result = await hooks.get("before_prompt_build")!(
      {
        prompt: "hello",
        messages: [],
      },
      {
        sessionKey: "agent:agent-1:task:task-1",
      }
    );

    expect(callMock).toHaveBeenCalledWith(
      "task.workflow.get",
      { sessionKey: "agent:agent-1:task:task-1" },
      { type: "query" }
    );
    expect(fetchMissionChainMock).toHaveBeenCalledWith(3);
    expect(result).toEqual(
      expect.objectContaining({
        prependSystemContext: expect.stringContaining(
          "HQ COMPLEX TASK WORKFLOW"
        ),
      })
    );
    expect(result?.prependSystemContext).toContain(
      "Role: Root assignee orchestrator."
    );
    expect(result?.prependSystemContext).toContain(
      "The planner must call record_task_plan and set_task_subtasks before handing control back to you."
    );
    expect(result?.prependSystemContext).not.toContain("validator subagent");
    expect(result?.prependSystemContext).toContain("MISSION CONTEXT");
  });

  it("injects planner guidance that records the plan and subtasks", async () => {
    const { hooks } = createPlugin();
    callMock.mockResolvedValue({
      task: {
        id: "task-1",
        title: "Complex task",
        description: "Ship the workflow",
        status: "doing",
        workflowMode: "complex",
        assignor: "lead",
        assignee: "agent-1",
        campaignId: null,
      },
      workflow: {
        status: "planning",
        planPath: ".openclaw/tasks/task-1/plan.md",
        planSummary: "Plan summary",
      },
      subtasks: [],
      sessions: [
        {
          id: 2,
          sessionKey: "agent:planner:subagent:abc",
          role: "planner",
          subtaskId: null,
          agentId: "planner",
          parentSessionKey: "agent:agent-1:task:task-1",
          startedAt: null,
          completedAt: null,
          endedAt: null,
        },
      ],
      summary: {
        mode: "complex",
        status: "planning",
        planPath: ".openclaw/tasks/task-1/plan.md",
        planSummary: "Plan summary",
        totalSubtasks: 0,
        completedSubtasks: 0,
        activeSubtaskId: null,
        blockedSubtaskId: null,
        rootAgentId: "agent-1",
        sessionKeys: ["agent:planner:subagent:abc"],
      },
    });

    const result = await hooks.get("before_prompt_build")!(
      {
        prompt: "hello",
        messages: [],
      },
      {
        sessionKey: "agent:planner:subagent:abc",
      }
    );

    expect(result?.prependSystemContext).toContain("Role: Planner subagent.");
    expect(result?.prependSystemContext).toContain(
      "After the plan is ready, call record_task_plan and then set_task_subtasks with the ordered execution list."
    );
  });

  it("injects worker guidance without a validator handoff", async () => {
    const { hooks } = createPlugin();
    callMock.mockResolvedValue({
      task: {
        id: "task-1",
        title: "Complex task",
        description: "Ship the workflow",
        status: "doing",
        workflowMode: "complex",
        assignor: "lead",
        assignee: "agent-1",
        campaignId: null,
      },
      workflow: {
        status: "executing",
        planPath: ".openclaw/tasks/task-1/plan.md",
        planSummary: "Plan summary",
      },
      subtasks: [
        {
          id: 11,
          position: 1,
          title: "Implement data model",
          instructions: "Add tables and enums",
          acceptanceCriteria: "Schema and API compile",
          status: "running",
          latestWorkerSummary: null,
          latestValidatorSummary: null,
          latestFeedback: null,
        },
      ],
      sessions: [
        {
          id: 3,
          sessionKey: "agent:worker:subagent:def",
          role: "worker",
          subtaskId: 11,
          agentId: "worker",
          parentSessionKey: "agent:agent-1:task:task-1",
          startedAt: null,
          completedAt: null,
          endedAt: null,
        },
      ],
      summary: {
        mode: "complex",
        status: "executing",
        planPath: ".openclaw/tasks/task-1/plan.md",
        planSummary: "Plan summary",
        totalSubtasks: 1,
        completedSubtasks: 0,
        activeSubtaskId: 11,
        blockedSubtaskId: null,
        rootAgentId: "agent-1",
        sessionKeys: ["agent:worker:subagent:def"],
      },
    });

    const result = await hooks.get("before_prompt_build")!(
      {
        prompt: "hello",
        messages: [],
      },
      {
        sessionKey: "agent:worker:subagent:def",
      }
    );

    expect(result?.prependSystemContext).toContain("Role: Worker subagent.");
    expect(result?.prependSystemContext).toContain(
      "Do the work, verify it against the acceptance criteria, then record a concise implementation summary and mark the subtask done with update_task_subtask."
    );
    expect(result?.prependSystemContext).not.toContain("validator subagent");
  });

  it("skips prompt enrichment when the session is not linked to a workflow", async () => {
    const { hooks } = createPlugin();
    callMock.mockRejectedValue(new Error("not found"));

    const result = await hooks.get("before_prompt_build")!(
      {
        prompt: "hello",
        messages: [],
      },
      {
        sessionKey: "agent:agent-1:task:task-1",
      }
    );

    expect(result).toBeUndefined();
    expect(fetchMissionChainMock).not.toHaveBeenCalled();
  });
});
