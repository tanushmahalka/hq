// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const callMock = vi.fn();

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
    fetchMissionChain: vi.fn(),
  })),
}));

vi.mock("openclaw/plugin-sdk/plugin-entry", () => ({
  definePluginEntry: (entry: unknown) => entry,
}));

import plugin from "./index";

type ToolDef = {
  name: string;
  execute: (
    id: string,
    params: Record<string, unknown>,
  ) => Promise<{ content: { type: string; text: string }[] }>;
};

type HookHandler = (
  event: Record<string, unknown>,
  meta: { agentId?: string; sessionKey?: string },
) => Promise<Record<string, unknown> | void> | Record<string, unknown> | void;

function createPlugin() {
  const tools = new Map<string, ToolDef>();
  const hooks = new Map<string, HookHandler>();

  plugin.register({
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

function createPluginWithPluginConfig() {
  const tools = new Map<string, ToolDef>();
  const hooks = new Map<string, HookHandler>();
  const warn = vi.fn();

  plugin.register({
    config: {},
    pluginConfig: {
      hqApiUrl: "https://hq.example.com/api/trpc",
      hqApiToken: "token",
    },
    logger: { warn },
    registerTool: (def) => {
      tools.set(def.name, def as ToolDef);
    },
    registerGatewayMethod: () => {},
    on: (event, handler) => {
      hooks.set(event, handler as HookHandler);
    },
  });

  return { tools, hooks, warn };
}

beforeEach(() => {
  callMock.mockReset();
});

describe("hq-missions plugin", () => {
  it("accepts plugin-scoped config from api.pluginConfig", async () => {
    const { tools, warn } = createPluginWithPluginConfig();
    callMock.mockResolvedValue({ id: "task-1" });

    await tools.get("create_task")!.execute("1", {
      title: "Write brief",
    });

    expect(callMock).toHaveBeenCalledWith(
      "task.create",
      expect.objectContaining({
        title: "Write brief",
      }),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("coerces campaign ids and forwards category for task create and update", async () => {
    const { tools } = createPlugin();
    callMock.mockResolvedValue({ id: "task-1" });

    await tools.get("create_task")!.execute("1", {
      title: "Write brief",
      campaignId: "42",
      category: "seo",
    });
    expect(callMock).toHaveBeenNthCalledWith(
      1,
      "task.create",
      expect.objectContaining({
        title: "Write brief",
        campaignId: 42,
        category: "seo",
      }),
    );

    await tools.get("update_task")!.execute("1", {
      taskId: "task-1",
      campaignId: "99",
      category: null,
    });
    expect(callMock).toHaveBeenNthCalledWith(2, "task.update", {
      id: "task-1",
      campaignId: 99,
      category: null,
    });
  });

  it("defaults create_task assignee to the calling agent", async () => {
    const { hooks } = createPlugin();

    const result = await hooks.get("before_tool_call")!(
      {
        toolName: "create_task",
        params: {
          title: "Write brief",
        },
      },
      {
        agentId: "mira-seo",
      },
    );

    expect(result).toEqual({
      params: {
        title: "Write brief",
        assignee: "mira-seo",
      },
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

  it("does not register removed workflow tools", () => {
    const { tools } = createPlugin();

    expect(tools.has("get_task_workflow")).toBe(false);
    expect(tools.has("record_task_plan")).toBe(false);
    expect(tools.has("set_task_subtasks")).toBe(false);
    expect(tools.has("update_task_subtask")).toBe(false);
    expect(tools.has("link_task_session")).toBe(false);
    expect(tools.has("complete_task_workflow")).toBe(false);
  });
});
