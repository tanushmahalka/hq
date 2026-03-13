// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const callMock = vi.fn();
const fetchMissionChainMock = vi.fn();

vi.mock("@sinclair/typebox", () => ({
  Type: {
    Object: (value: unknown) => value,
    Optional: (value: unknown) => value,
    Union: (value: unknown) => value,
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

type HookHandler = (ctx: {
  task: Record<string, unknown>;
  sessionKey: string;
  prependSystemContext: (text: string) => Promise<void>;
}) => Promise<void>;

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
    registerHook: (event, handler) => {
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
  it("coerces campaign ids for task create and update", async () => {
    const { tools } = createPlugin();
    callMock.mockResolvedValue({ id: "task-1" });

    await tools.get("create_task")!.execute("1", {
      title: "Write brief",
      campaignId: "42",
    });
    expect(callMock).toHaveBeenNthCalledWith(
      1,
      "task.create",
      expect.objectContaining({
        title: "Write brief",
        campaignId: 42,
      })
    );

    await tools.get("update_task")!.execute("1", {
      taskId: "task-1",
      campaignId: "99",
    });
    expect(callMock).toHaveBeenNthCalledWith(2, "task.update", {
      id: "task-1",
      campaignId: 99,
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

  it("coerces hook campaign ids before fetching mission context", async () => {
    const { hooks } = createPlugin();
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

    const prependSystemContext = vi.fn(async () => {});
    await hooks.get("task:dispatched")!({
      task: { campaignId: "3" },
      sessionKey: "agent:agent-1:task:task-1",
      prependSystemContext,
    });

    expect(fetchMissionChainMock).toHaveBeenCalledWith(3);
    expect(prependSystemContext).toHaveBeenCalledTimes(1);
  });
});
