import { Type } from "@sinclair/typebox";
import { createHQClient, type HQClient } from "./hq-client";
import { formatMissionContext } from "./format-context";

interface PluginAPI {
  config: unknown;
  registerTool: (def: {
    name: string;
    description: string;
    parameters: unknown;
    execute: (
      id: string,
      params: Record<string, unknown>
    ) => Promise<{ content: { type: string; text: string }[] }>;
  }) => void;
  registerGatewayMethod: (
    name: string,
    handler: (ctx: {
      params: Record<string, unknown>;
      respond: (ok: boolean, data: unknown) => void;
    }) => Promise<void>
  ) => void;
  registerHook: (
    event: string,
    handler: (ctx: {
      task: Record<string, unknown>;
      sessionKey: string;
      prependSystemContext: (text: string) => Promise<void>;
    }) => Promise<void>,
    meta: { name: string; description: string }
  ) => void;
}

type HQMissionsConfig = {
  hqApiUrl?: string;
  hqApiToken?: string;
  autoEnrich?: boolean;
};

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolvePluginConfig(config: unknown): HQMissionsConfig {
  const hasUsableConfig = (value: HQMissionsConfig): boolean =>
    Boolean(value.hqApiUrl || value.hqApiToken || typeof value.autoEnrich === "boolean");

  const extractConfig = (value: unknown): HQMissionsConfig => {
    if (!value || typeof value !== "object") return {};

    const direct = value as HQMissionsConfig;
    const directUrl = toNonEmptyString(direct.hqApiUrl);
    const directToken = toNonEmptyString(direct.hqApiToken);
    if (directUrl || directToken || typeof direct.autoEnrich === "boolean") {
      return {
        hqApiUrl: directUrl,
        hqApiToken: directToken,
        autoEnrich: direct.autoEnrich,
      };
    }

    const nested = (value as { config?: HQMissionsConfig }).config;
    if (!nested) return {};
    const nestedUrl = toNonEmptyString(nested.hqApiUrl);
    const nestedToken = toNonEmptyString(nested.hqApiToken);
    if (nestedUrl || nestedToken || typeof nested.autoEnrich === "boolean") {
      return {
        hqApiUrl: nestedUrl,
        hqApiToken: nestedToken,
        autoEnrich: nested.autoEnrich,
      };
    }

    return {};
  };

  const direct = extractConfig(config);
  if (hasUsableConfig(direct)) {
    return direct;
  }

  const entries =
    (config as {
      plugins?: { entries?: Record<string, { config?: HQMissionsConfig }> };
    })?.plugins?.entries ?? {};
  const shallowEntries =
    (config as { entries?: Record<string, unknown> })?.entries ?? {};
  const topLevel = (config as Record<string, unknown>) ?? {};

  const configuredIds = Array.from(
    new Set([
      ...Object.keys(entries),
      ...Object.keys(shallowEntries),
      ...Object.keys(topLevel),
    ])
  );
  const preferredIds = [
    "hq-missions",
    "@psx/hq-missions",
    "psx/hq-missions",
    ...configuredIds.filter((id) => id.endsWith("/hq-missions")),
  ];

  for (const id of preferredIds) {
    const fromEntries = extractConfig(entries[id]);
    if (hasUsableConfig(fromEntries)) return fromEntries;

    const fromShallowEntries = extractConfig(shallowEntries[id]);
    if (hasUsableConfig(fromShallowEntries)) return fromShallowEntries;

    const fromTopLevel = extractConfig(topLevel[id]);
    if (hasUsableConfig(fromTopLevel)) return fromTopLevel;
  }

  return {};
}

export default function register(api: PluginAPI) {
  const resolved = resolvePluginConfig(api.config);
  const env = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  const config: Required<Pick<HQMissionsConfig, "hqApiUrl" | "hqApiToken">> & {
    autoEnrich?: boolean;
  } = {
    hqApiUrl:
      resolved.hqApiUrl ??
      toNonEmptyString(env?.HQ_API_URL) ??
      toNonEmptyString(env?.OPENCLAW_HQ_API_URL) ??
      "",
    hqApiToken:
      resolved.hqApiToken ??
      toNonEmptyString(env?.HQ_API_TOKEN) ??
      toNonEmptyString(env?.OPENCLAW_HQ_API_TOKEN) ??
      "",
    autoEnrich: resolved.autoEnrich,
  };

  if (!config.hqApiUrl || !config.hqApiToken) {
    console.warn(
      "[hq-missions] Missing hqApiUrl or hqApiToken — plugin inactive. Set config via plugins.entries.<plugin-id>.config (e.g. hq-missions), or env HQ_API_URL/HQ_API_TOKEN."
    );
    return;
  }
  const hq: HQClient = createHQClient(config.hqApiUrl, config.hqApiToken);

  // ── Agent Tools ──

  api.registerTool({
    name: "get_mission_briefing",
    description:
      "Get the full mission briefing for the current agent, including all objectives, campaigns, and their linked tasks. Call this when starting work on a task that has a campaignId to understand the broader strategic context.",
    parameters: Type.Object({
      agentId: Type.Optional(
        Type.String({ description: "Agent ID (defaults to current agent)" })
      ),
    }),
    async execute(_id, params) {
      const briefing = await hq.call(
        "custom.mission.list",
        params.agentId ? { agentId: params.agentId as string } : undefined,
        { type: "query" }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(briefing, null, 2) }],
      };
    },
  });

  api.registerTool({
    name: "update_campaign_status",
    description:
      "Update a campaign's status (planned, active, paused, completed, failed). Use this when you've finished a campaign's work or need to mark it as failed.",
    parameters: Type.Object({
      campaignId: Type.String(),
      status: Type.Union([
        Type.Literal("planned"),
        Type.Literal("active"),
        Type.Literal("paused"),
        Type.Literal("completed"),
        Type.Literal("failed"),
      ]),
    }),
    async execute(_id, params) {
      await hq.call("custom.campaign.update", {
        id: params.campaignId as string,
        status: params.status as string,
      });
      return {
        content: [
          {
            type: "text",
            text: `Campaign ${params.campaignId} → ${params.status}`,
          },
        ],
      };
    },
  });

  api.registerTool({
    name: "update_objective_metric",
    description:
      "Report a metric update for an objective. Use this to track progress (e.g., 'current organic visits: 5200').",
    parameters: Type.Object({
      objectiveId: Type.String(),
      currentValue: Type.String({ description: "Current metric value" }),
    }),
    async execute(_id, params) {
      await hq.call("custom.objective.update", {
        id: params.objectiveId as string,
        currentValue: params.currentValue as string,
      });
      return {
        content: [
          {
            type: "text",
            text: `Objective metric updated: ${params.currentValue}`,
          },
        ],
      };
    },
  });

  api.registerTool({
    name: "log_campaign_learnings",
    description:
      "Record learnings/reflections for a campaign. Use this after completing or reviewing a campaign to capture what worked, what didn't, and insights for future campaigns.",
    parameters: Type.Object({
      campaignId: Type.String(),
      learnings: Type.String({
        description: "What was learned from this campaign",
      }),
    }),
    async execute(_id, params) {
      await hq.call("custom.campaign.update", {
        id: params.campaignId as string,
        learnings: params.learnings as string,
      });
      return {
        content: [{ type: "text", text: "Learnings recorded." }],
      };
    },
  });

  api.registerTool({
    name: "create_mission",
    description:
      "Create a new mission for an agent. A mission is the top-level strategic directive that groups objectives and campaigns.",
    parameters: Type.Object({
      agentId: Type.String({ description: "ID of the agent this mission belongs to" }),
      title: Type.String({ description: "Mission title" }),
      description: Type.Optional(Type.String({ description: "Mission description" })),
      organizationId: Type.String({ description: "Organization ID this mission belongs to" }),
    }),
    async execute(_id, params) {
      const mission = await hq.call("custom.mission.create", {
        agentId: params.agentId as string,
        title: params.title as string,
        description: params.description as string | undefined,
        organizationId: params.organizationId as string,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(mission, null, 2) }],
      };
    },
  });

  api.registerTool({
    name: "create_objective",
    description:
      "Create a new objective under a mission. An objective defines a measurable outcome with an optional target metric (e.g., 'organic visits: 5000').",
    parameters: Type.Object({
      missionId: Type.String({ description: "UUID of the parent mission" }),
      title: Type.String({ description: "Objective title" }),
      description: Type.Optional(Type.String()),
      hypothesis: Type.Optional(Type.String({ description: "Hypothesis for achieving this objective" })),
      targetMetric: Type.Optional(Type.String({ description: "Metric to track (e.g., 'organic visits')" })),
      targetValue: Type.Optional(Type.String({ description: "Target value to reach (e.g., '5000')" })),
      currentValue: Type.Optional(Type.String({ description: "Current baseline value (e.g., '1200')" })),
      dueDateIso: Type.Optional(Type.String({ description: "ISO date/time deadline" })),
      sortOrder: Type.Optional(Type.Number({ description: "Ordering index within mission" })),
    }),
    async execute(_id, params) {
      const objective = await hq.call("custom.objective.create", {
        missionId: params.missionId as string,
        title: params.title as string,
        description: params.description as string | undefined,
        hypothesis: params.hypothesis as string | undefined,
        targetMetric: params.targetMetric as string | undefined,
        targetValue: params.targetValue as string | undefined,
        currentValue: params.currentValue as string | undefined,
        dueDate: params.dueDateIso
          ? new Date(params.dueDateIso as string)
          : undefined,
        sortOrder: params.sortOrder as number | undefined,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(objective, null, 2) }],
      };
    },
  });

  api.registerTool({
    name: "create_campaign",
    description:
      "Create a new campaign under an objective. A campaign is a specific initiative with a hypothesis to test, executed to move an objective's metric.",
    parameters: Type.Object({
      objectiveId: Type.String({ description: "UUID of the parent objective" }),
      title: Type.String({ description: "Campaign title" }),
      description: Type.Optional(Type.String()),
      hypothesis: Type.Optional(Type.String({ description: "What you expect this campaign to achieve and why" })),
      startDateIso: Type.Optional(Type.String({ description: "ISO start date/time" })),
      endDateIso: Type.Optional(Type.String({ description: "ISO end date/time" })),
      sortOrder: Type.Optional(Type.Number({ description: "Ordering index within objective" })),
    }),
    async execute(_id, params) {
      const campaign = await hq.call("custom.campaign.create", {
        objectiveId: params.objectiveId as string,
        title: params.title as string,
        description: params.description as string | undefined,
        hypothesis: params.hypothesis as string | undefined,
        startDate: params.startDateIso
          ? new Date(params.startDateIso as string)
          : undefined,
        endDate: params.endDateIso
          ? new Date(params.endDateIso as string)
          : undefined,
        sortOrder: params.sortOrder as number | undefined,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(campaign, null, 2) }],
      };
    },
  });

  api.registerTool({
    name: "list_campaign_tasks",
    description:
      "List all tasks linked to a specific campaign, showing their status and progress.",
    parameters: Type.Object({
      campaignId: Type.String(),
    }),
    async execute(_id, params) {
      const tasks = (await hq.call<
        { campaignId?: string; id: string; title: string; status: string }[]
      >("task.list", undefined, { type: "query" })) as {
        campaignId?: string;
        id: string;
        title: string;
        status: string;
      }[];
      const linked = tasks.filter(
        (t) => t.campaignId === (params.campaignId as string)
      );
      return {
        content: [{ type: "text", text: JSON.stringify(linked, null, 2) }],
      };
    },
  });

  api.registerTool({
    name: "create_task",
    description:
      "Create a task in HQ. Use this instead of Todo-CLI for task creation.",
    parameters: Type.Object({
      title: Type.String({ description: "Task title" }),
      description: Type.Optional(Type.String({ description: "Task description" })),
      status: Type.Optional(
        Type.Union([
          Type.Literal("todo"),
          Type.Literal("doing"),
          Type.Literal("stuck"),
          Type.Literal("done"),
        ])
      ),
      assignor: Type.Optional(Type.String()),
      assignee: Type.Optional(Type.String()),
      dueDateIso: Type.Optional(
        Type.String({ description: "ISO date/time for due date" })
      ),
      urgent: Type.Optional(Type.Boolean()),
      important: Type.Optional(Type.Boolean()),
      campaignId: Type.Optional(Type.String()),
      organizationId: Type.Optional(
        Type.String({
          description:
            "Organization ID (required when agent context does not provide org)",
        })
      ),
    }),
    async execute(_id, params) {
      const task = await hq.call("task.create", {
        title: params.title as string,
        description: params.description as string | undefined,
        status: params.status as "todo" | "doing" | "stuck" | "done" | undefined,
        assignor: params.assignor as string | undefined,
        assignee: params.assignee as string | undefined,
        dueDate: params.dueDateIso
          ? new Date(params.dueDateIso as string)
          : undefined,
        urgent: params.urgent as boolean | undefined,
        important: params.important as boolean | undefined,
        campaignId: params.campaignId as string | undefined,
        organizationId: params.organizationId as string | undefined,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(task, null, 2) }],
      };
    },
  });

  api.registerTool({
    name: "list_tasks",
    description:
      "List HQ tasks, optionally filtered by status. Use this instead of Todo-CLI.",
    parameters: Type.Object({
      status: Type.Optional(
        Type.Union([
          Type.Literal("todo"),
          Type.Literal("doing"),
          Type.Literal("stuck"),
          Type.Literal("done"),
        ])
      ),
    }),
    async execute(_id, params) {
      const tasks = await hq.call(
        "task.list",
        params.status ? { status: params.status as string } : undefined,
        { type: "query" }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }],
      };
    },
  });

  api.registerTool({
    name: "get_task",
    description: "Get one HQ task by ID, including comments.",
    parameters: Type.Object({
      taskId: Type.String(),
    }),
    async execute(_id, params) {
      const task = await hq.call(
        "task.get",
        { id: params.taskId as string },
        { type: "query" }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(task, null, 2) }],
      };
    },
  });

  api.registerTool({
    name: "update_task",
    description: "Update an existing HQ task by ID.",
    parameters: Type.Object({
      taskId: Type.String(),
      title: Type.Optional(Type.String()),
      description: Type.Optional(
        Type.Union([Type.String(), Type.Null()])
      ),
      status: Type.Optional(
        Type.Union([
          Type.Literal("todo"),
          Type.Literal("doing"),
          Type.Literal("stuck"),
          Type.Literal("done"),
        ])
      ),
      assignor: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      assignee: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      dueDateIso: Type.Optional(
        Type.Union([
          Type.String({ description: "ISO date/time for due date" }),
          Type.Null(),
        ])
      ),
      urgent: Type.Optional(Type.Boolean()),
      important: Type.Optional(Type.Boolean()),
    }),
    async execute(_id, params) {
      const payload: Record<string, unknown> = {
        id: params.taskId as string,
      };
      if (params.title !== undefined) payload.title = params.title;
      if (params.description !== undefined) payload.description = params.description;
      if (params.status !== undefined) payload.status = params.status;
      if (params.assignor !== undefined) payload.assignor = params.assignor;
      if (params.assignee !== undefined) payload.assignee = params.assignee;
      if (params.dueDateIso !== undefined) {
        payload.dueDate =
          params.dueDateIso === null
            ? null
            : new Date(params.dueDateIso as string);
      }
      if (params.urgent !== undefined) payload.urgent = params.urgent;
      if (params.important !== undefined) payload.important = params.important;

      const task = await hq.call("task.update", payload);
      return {
        content: [{ type: "text", text: JSON.stringify(task, null, 2) }],
      };
    },
  });

  api.registerTool({
    name: "delete_task",
    description: "Delete an HQ task by ID.",
    parameters: Type.Object({
      taskId: Type.String(),
    }),
    async execute(_id, params) {
      const result = await hq.call("task.delete", { id: params.taskId as string });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  });

  api.registerTool({
    name: "add_task_comment",
    description:
      "Add a comment to a task in HQ. Use this instead of Todo-CLI comments.",
    parameters: Type.Object({
      taskId: Type.String(),
      author: Type.String({ description: "Comment author display name" }),
      content: Type.String({ description: "Comment text" }),
    }),
    async execute(_id, params) {
      const comment = await hq.call("task.comment.add", {
        taskId: params.taskId as string,
        author: params.author as string,
        content: params.content as string,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(comment, null, 2) }],
      };
    },
  });

  api.registerTool({
    name: "delete_task_comment",
    description: "Delete a task comment by comment UUID.",
    parameters: Type.Object({
      commentId: Type.String({ description: "Task comment UUID" }),
    }),
    async execute(_id, params) {
      const result = await hq.call("task.comment.delete", {
        id: params.commentId as string,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  });

  // ── Gateway RPC ──

  api.registerGatewayMethod("hq-missions.sync", async ({ params, respond }) => {
    const { agentId } = params as { agentId?: string };
    const briefing = await hq.call(
      "custom.mission.list",
      agentId ? { agentId } : undefined,
      { type: "query" }
    );
    respond(true, { ok: true, missions: briefing });
  });

  api.registerGatewayMethod("hq-missions.status", async ({ respond }) => {
    respond(true, { ok: true, connected: true });
  });

  // ── Hook: Enrich task context with mission chain ──

  api.registerHook(
    "task:dispatched",
    async (ctx) => {
      if (config.autoEnrich === false) return;
      const { task } = ctx;
      if (!task.campaignId) return;

      const chain = await hq.fetchMissionChain(task.campaignId as string);
      if (!chain) return;

      const context = formatMissionContext(chain);
      await ctx.prependSystemContext(context);
    },
    {
      name: "hq-missions.enrich-task",
      description:
        "Injects mission/objective/campaign context into task sessions",
    }
  );
}
