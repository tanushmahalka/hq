import { Type } from "@sinclair/typebox";
import { createHQClient, type HQClient } from "./hq-client";
import { formatMissionContext } from "./format-context";
import { TASK_CATEGORY_LABELS, type TaskCategory } from "../../shared/types.ts";

interface PluginAPI {
  config: unknown;
  pluginConfig?: Record<string, unknown>;
  logger?: {
    warn: (message: string) => void;
  };
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
  on: (
    hookName: string,
    handler: (
      event: Record<string, unknown>,
      ctx: { agentId?: string; sessionKey?: string }
    ) => Promise<Record<string, unknown> | void> | Record<string, unknown> | void,
    opts?: { priority?: number }
  ) => void;
}

type HQMissionsConfig = {
  hqApiUrl?: string;
  hqApiToken?: string;
  autoEnrich?: boolean;
};

type WorkflowSubtask = {
  id: number;
  position: number;
  title: string;
  instructions: string | null;
  acceptanceCriteria: string | null;
  status: string;
  latestWorkerSummary: string | null;
  latestValidatorSummary: string | null;
  latestFeedback: string | null;
};

type WorkflowSession = {
  id: number;
  sessionKey: string;
  role: "root" | "planner" | "worker" | "validator";
  subtaskId: number | null;
  agentId: string | null;
  parentSessionKey: string | null;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  endedAt: Date | string | null;
};

type WorkflowSummary = {
  mode: "simple" | "complex";
  status: string | null;
  planPath: string | null;
  planSummary: string | null;
  totalSubtasks: number;
  completedSubtasks: number;
  activeSubtaskId: number | null;
  blockedSubtaskId: number | null;
  rootAgentId: string | null;
  sessionKeys: string[];
};

type WorkflowDetail = {
  task: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    category?: TaskCategory | null;
    workflowMode: "simple" | "complex";
    assignor: string | null;
    assignee: string | null;
    campaignId?: number | null;
  };
  workflow: {
    status: string;
    planPath: string | null;
    planSummary: string | null;
  } | null;
  subtasks: WorkflowSubtask[];
  sessions: WorkflowSession[];
  summary: WorkflowSummary;
};

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const parsed = Number(trimmed);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function requirePositiveInt(value: unknown, field: string): number {
  const parsed = parsePositiveInt(value);
  if (parsed === null) {
    throw new Error(`${field} must be a positive integer`);
  }
  return parsed;
}

function numericIdSchema(description: string) {
  return Type.Union([
    Type.Number({ description }),
    Type.String({ description: `${description} as a stringified integer` }),
  ]);
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toOptionalDate(value: unknown): Date | undefined {
  const raw = toNonEmptyString(value);
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatTaskCategory(category: TaskCategory | null | undefined): string | null {
  if (!category) {
    return null;
  }
  return TASK_CATEGORY_LABELS[category];
}

function applyDefaultTaskAssignee(params: {
  toolName?: unknown;
  rawParams: unknown;
  agentId?: string;
}) {
  if (params.toolName !== "create_task") {
    return undefined;
  }

  const agentId = toNonEmptyString(params.agentId);
  if (!agentId || typeof params.rawParams !== "object" || params.rawParams === null) {
    return undefined;
  }

  const rawParams = params.rawParams as Record<string, unknown>;
  if (toNonEmptyString(rawParams.assignee)) {
    return undefined;
  }

  return {
    ...rawParams,
    assignee: agentId,
  };
}

function buildTaskPlanPath(taskId: string) {
  return `.openclaw/tasks/${taskId}/plan.md`;
}

function formatSubtaskForPrompt(subtask: WorkflowSubtask): string[] {
  const lines = [
    `Subtask ${subtask.position}: ${subtask.title}`,
    `Status: ${subtask.status}`,
  ];

  if (subtask.instructions) {
    lines.push(`Instructions: ${subtask.instructions}`);
  }
  if (subtask.acceptanceCriteria) {
    lines.push(`Acceptance Criteria: ${subtask.acceptanceCriteria}`);
  }
  if (subtask.latestWorkerSummary) {
    lines.push(`Latest Worker Summary: ${subtask.latestWorkerSummary}`);
  }
  if (subtask.latestValidatorSummary) {
    lines.push(`Latest Validator Summary: ${subtask.latestValidatorSummary}`);
  }
  if (subtask.latestFeedback) {
    lines.push(`Latest Feedback: ${subtask.latestFeedback}`);
  }

  return lines;
}

function buildWorkflowRoleGuidance(params: {
  role: WorkflowSession["role"];
  planPath: string;
  subtask: WorkflowSubtask | null;
}) {
  const { role, planPath, subtask } = params;

  if (role === "root") {
    return [
      "Role: Root assignee orchestrator.",
      "You own the full task lifecycle in HQ.",
      `Plan first by spawning a planner subagent and having it write ${planPath}.`,
      "The planner must call record_task_plan and set_task_subtasks before handing control back to you.",
      "Push the planner toward failure-isolating subtasks: independent targets should usually become separate subtasks or very small deterministic batches.",
      "Do not let the planner bundle many unrelated imports, domains, files, or entities into one broad execution step just because the same script can process them.",
      "Run subtasks sequentially. Only one subtask may be running at a time.",
      "When you spawn planner or worker sessions, link them in HQ immediately with link_task_session.",
      "If a subtask needs revision, you handle retries or spawn a fresh worker.",
      "You are the only actor allowed to call complete_task_workflow.",
    ];
  }

  if (role === "planner") {
    return [
      "Role: Planner subagent.",
      `Write the implementation plan to ${planPath}.`,
      "Break the work into the smallest reliable independently verifiable subtasks that still make operational sense.",
      "When the task repeats across many independent targets, prefer one target per subtask or a very small deterministic batch with an explicit reason.",
      "Example: if 18 competitors each need a backlink import, shared setup can be one subtask, but the competitor imports should usually be separate subtasks so retries and status tracking stay isolated.",
      "Bias toward smaller subtasks when work touches external systems or partial-write risk.",
      "After the plan is ready, call record_task_plan and then set_task_subtasks with the ordered execution list.",
      "Return the relative plan path and a concise summary to the root assignee after both HQ updates succeed.",
      "Do not execute subtasks, update subtask statuses after planning, or complete the workflow.",
    ];
  }

  if (role === "worker") {
    return [
      "Role: Worker subagent.",
      ...(subtask
        ? formatSubtaskForPrompt(subtask)
        : ["No linked subtask metadata was found yet."]),
      "Start by marking your linked subtask as running if the root has not already done so.",
      "Do the work, verify it against the acceptance criteria, then record a concise implementation summary and mark the subtask done with update_task_subtask.",
      "Do not call complete_task_workflow.",
    ];
  }

  return [
    "Role: Validator subagent.",
    ...(subtask
      ? formatSubtaskForPrompt(subtask)
      : ["No linked subtask metadata was found yet."]),
    "Review the completed work against the subtask acceptance criteria.",
    "Record the validation result with update_task_subtask using status done or needs_revision.",
    "Use latestValidatorSummary for the verdict and latestFeedback for requested changes when needed.",
    "Do not execute unrelated implementation work and do not call complete_task_workflow.",
  ];
}

async function maybeBuildWorkflowPromptContext(params: {
  hq: HQClient;
  sessionKey?: string;
}): Promise<string | null> {
  if (!params.sessionKey) {
    return null;
  }

  let detail: WorkflowDetail;
  try {
    detail = await params.hq.call<WorkflowDetail>(
      "task.workflow.get",
      { sessionKey: params.sessionKey },
      { type: "query" }
    );
  } catch {
    return null;
  }

  const session =
    detail.sessions.find((entry) => entry.sessionKey === params.sessionKey) ??
    null;
  if (!session) {
    return null;
  }

  const planPath = detail.summary.planPath ?? buildTaskPlanPath(detail.task.id);
  const subtask =
    session.subtaskId != null
      ? detail.subtasks.find((entry) => entry.id === session.subtaskId) ?? null
      : null;

  const lines = [
    "HQ COMPLEX TASK WORKFLOW",
    "========================",
    `Task ID: ${detail.task.id}`,
    `Title: ${detail.task.title}`,
    `Task Status: ${detail.task.status}`,
    `Workflow Status: ${detail.summary.status ?? "planning"}`,
    `Plan File: ${planPath}`,
    `Artifacts Root: .openclaw/tasks/${detail.task.id}/`,
    detail.task.description ? `Description: ${detail.task.description}` : null,
    detail.task.assignor ? `Assignor: ${detail.task.assignor}` : null,
    detail.task.assignee ? `Assignee: ${detail.task.assignee}` : null,
    detail.task.category ? `Category: ${formatTaskCategory(detail.task.category)}` : null,
    "",
    "Global Contract:",
    "- HQ is the source of truth for workflow state, subtasks, and linked sessions.",
    "- The planner writes plan.md first, records the plan in HQ, and creates the ordered subtask list before execution.",
    "- Only one subtask may be running at a time in this workflow.",
    "- Each worker owns its linked subtask end-to-end and records the outcome in HQ.",
    "- Only the root assignee completes the workflow.",
    "",
    ...buildWorkflowRoleGuidance({
      role: session.role,
      planPath,
      subtask,
    }),
  ].filter(Boolean);

  if (detail.summary.planSummary) {
    lines.push("", `Plan Summary: ${detail.summary.planSummary}`);
  }

  if (detail.subtasks.length > 0) {
    lines.push("", "Current Subtasks:");
    for (const entry of detail.subtasks) {
      lines.push(
        `- [${entry.status}] ${entry.position}. ${entry.title}${
          entry.id === detail.summary.activeSubtaskId ? " (active)" : ""
        }${entry.id === detail.summary.blockedSubtaskId ? " (blocked)" : ""}`
      );
    }
  }

  if (detail.task.campaignId) {
    const chain = await params.hq.fetchMissionChain(detail.task.campaignId);
    if (chain) {
      lines.push("", formatMissionContext(chain));
    }
  }

  return lines.join("\n");
}

function resolvePluginConfig(config: unknown): HQMissionsConfig {
  const hasUsableConfig = (value: HQMissionsConfig): boolean =>
    Boolean(
      value.hqApiUrl ||
        value.hqApiToken ||
        typeof value.autoEnrich === "boolean"
    );

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
    (
      config as {
        plugins?: { entries?: Record<string, { config?: HQMissionsConfig }> };
      }
    )?.plugins?.entries ?? {};
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
  const resolved = resolvePluginConfig(api.pluginConfig ?? api.config);
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
    api.logger?.warn?.(
      "[hq-missions] Missing hqApiUrl or hqApiToken - plugin inactive. Set config via pluginConfig or plugins.entries.<plugin-id>.config (e.g. hq-missions), or env HQ_API_URL/HQ_API_TOKEN."
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
      campaignId: numericIdSchema("Campaign ID"),
      status: Type.Union([
        Type.Literal("planned"),
        Type.Literal("active"),
        Type.Literal("paused"),
        Type.Literal("completed"),
        Type.Literal("failed"),
      ]),
    }),
    async execute(_id, params) {
      const campaignId = requirePositiveInt(params.campaignId, "campaignId");
      await hq.call("custom.campaign.update", {
        id: campaignId,
        status: params.status as string,
      });
      return {
        content: [
          {
            type: "text",
            text: `Campaign ${campaignId} → ${params.status}`,
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
      objectiveId: numericIdSchema("Objective ID"),
      currentValue: Type.String({ description: "Current metric value" }),
    }),
    async execute(_id, params) {
      const objectiveId = requirePositiveInt(params.objectiveId, "objectiveId");
      await hq.call("custom.objective.update", {
        id: objectiveId,
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
      campaignId: numericIdSchema("Campaign ID"),
      learnings: Type.String({
        description: "What was learned from this campaign",
      }),
    }),
    async execute(_id, params) {
      const campaignId = requirePositiveInt(params.campaignId, "campaignId");
      await hq.call("custom.campaign.update", {
        id: campaignId,
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
      agentId: Type.String({
        description: "ID of the agent this mission belongs to",
      }),
      title: Type.String({ description: "Mission title" }),
      description: Type.Optional(
        Type.String({ description: "Mission description" })
      ),
      organizationId: Type.String({
        description: "Organization ID this mission belongs to",
      }),
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
      missionId: numericIdSchema("Numeric ID of the parent mission"),
      title: Type.String({ description: "Objective title" }),
      description: Type.Optional(Type.String()),
      hypothesis: Type.Optional(
        Type.String({ description: "Hypothesis for achieving this objective" })
      ),
      targetMetric: Type.Optional(
        Type.String({ description: "Metric to track (e.g., 'organic visits')" })
      ),
      targetValue: Type.Optional(
        Type.String({ description: "Target value to reach (e.g., '5000')" })
      ),
      currentValue: Type.Optional(
        Type.String({ description: "Current baseline value (e.g., '1200')" })
      ),
      dueDateIso: Type.Optional(
        Type.String({ description: "ISO date/time deadline" })
      ),
      sortOrder: Type.Optional(
        Type.Number({ description: "Ordering index within mission" })
      ),
    }),
    async execute(_id, params) {
      const missionId = requirePositiveInt(params.missionId, "missionId");
      const objective = await hq.call("custom.objective.create", {
        missionId,
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
      objectiveId: numericIdSchema("Numeric ID of the parent objective"),
      title: Type.String({ description: "Campaign title" }),
      description: Type.Optional(Type.String()),
      hypothesis: Type.Optional(
        Type.String({
          description: "What you expect this campaign to achieve and why",
        })
      ),
      startDateIso: Type.Optional(
        Type.String({ description: "ISO start date/time" })
      ),
      endDateIso: Type.Optional(
        Type.String({ description: "ISO end date/time" })
      ),
      sortOrder: Type.Optional(
        Type.Number({ description: "Ordering index within objective" })
      ),
    }),
    async execute(_id, params) {
      const objectiveId = requirePositiveInt(params.objectiveId, "objectiveId");
      const campaign = await hq.call("custom.campaign.create", {
        objectiveId,
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
      campaignId: numericIdSchema("Campaign ID"),
    }),
    async execute(_id, params) {
      const campaignId = requirePositiveInt(params.campaignId, "campaignId");
      const tasks = (await hq.call<
        {
          campaignId?: number | null;
          category?: TaskCategory | null;
          id: string;
          title: string;
          status: string;
        }[]
      >("task.list", undefined, { type: "query" })) as {
        campaignId?: number | null;
        category?: TaskCategory | null;
        id: string;
        title: string;
        status: string;
      }[];
      const linked = tasks.filter((t) => t.campaignId === campaignId);
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
      description: Type.Optional(
        Type.String({ description: "Task description" })
      ),
      status: Type.Optional(
        Type.Union([
          Type.Literal("todo"),
          Type.Literal("doing"),
          Type.Literal("stuck"),
          Type.Literal("done"),
        ])
      ),
      category: Type.Optional(
        Type.Union([Type.Literal("seo"), Type.Literal("marketing"), Type.Null()])
      ),
      workflowMode: Type.Optional(
        Type.Union([Type.Literal("simple"), Type.Literal("complex")])
      ),
      assignor: Type.Optional(Type.String()),
      assignee: Type.Optional(
        Type.String({
          description:
            "The agent ID to assign this task to. Must be one of the available agents in the config.",
        })
      ),
      dueDateIso: Type.Optional(
        Type.String({ description: "ISO date/time for due date" })
      ),
      urgent: Type.Optional(Type.Boolean()),
      important: Type.Optional(Type.Boolean()),
      campaignId: Type.Optional(numericIdSchema("Campaign ID")),
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
        status: params.status as
          | "todo"
          | "doing"
          | "stuck"
          | "done"
          | undefined,
        category: (params.category ?? undefined) as TaskCategory | null | undefined,
        workflowMode: params.workflowMode as "simple" | "complex" | undefined,
        assignor: params.assignor as string | undefined,
        assignee: params.assignee as string | undefined,
        dueDate: params.dueDateIso
          ? new Date(params.dueDateIso as string)
          : undefined,
        urgent: params.urgent as boolean | undefined,
        important: params.important as boolean | undefined,
        campaignId:
          params.campaignId === undefined
            ? undefined
            : requirePositiveInt(params.campaignId, "campaignId"),
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
      description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      status: Type.Optional(
        Type.Union([
          Type.Literal("todo"),
          Type.Literal("doing"),
          Type.Literal("stuck"),
          Type.Literal("done"),
        ])
      ),
      category: Type.Optional(
        Type.Union([Type.Literal("seo"), Type.Literal("marketing"), Type.Null()])
      ),
      workflowMode: Type.Optional(
        Type.Union([Type.Literal("simple"), Type.Literal("complex")])
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
      campaignId: Type.Optional(
        Type.Union([numericIdSchema("Campaign ID"), Type.Null()])
      ),
    }),
    async execute(_id, params) {
      const payload: Record<string, unknown> = {
        id: params.taskId as string,
      };
      if (params.title !== undefined) payload.title = params.title;
      if (params.description !== undefined)
        payload.description = params.description;
      if (params.status !== undefined) payload.status = params.status;
      if (params.category !== undefined) payload.category = params.category;
      if (params.workflowMode !== undefined)
        payload.workflowMode = params.workflowMode;
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
      if (params.campaignId !== undefined) {
        payload.campaignId =
          params.campaignId === null
            ? null
            : requirePositiveInt(params.campaignId, "campaignId");
      }

      const task = await hq.call("task.update", payload);
      return {
        content: [{ type: "text", text: JSON.stringify(task, null, 2) }],
      };
    },
  });

  api.registerTool({
    name: "get_task_workflow",
    description:
      "Get the workflow state for a complex HQ task, either by task ID or by the current linked session key.",
    parameters: Type.Object({
      taskId: Type.Optional(Type.String()),
      sessionKey: Type.Optional(Type.String()),
    }),
    async execute(_id, params) {
      if (!params.taskId && !params.sessionKey) {
        throw new Error("taskId or sessionKey is required");
      }

      const workflow = await hq.call(
        "task.workflow.get",
        {
          taskId: params.taskId as string | undefined,
          sessionKey: params.sessionKey as string | undefined,
        },
        { type: "query" }
      );

      return {
        content: [{ type: "text", text: JSON.stringify(workflow, null, 2) }],
      };
    },
  });

  api.registerTool({
    name: "record_task_plan",
    description:
      "Record the plan artifact for a complex HQ task after the planner has written plan.md.",
    parameters: Type.Object({
      taskId: Type.String(),
      planPath: Type.String({
        description:
          "Relative path to the plan artifact, for example .openclaw/tasks/<taskId>/plan.md",
      }),
      planSummary: Type.Optional(Type.String()),
    }),
    async execute(_id, params) {
      const workflow = await hq.call("task.workflow.recordPlan", {
        taskId: params.taskId as string,
        planPath: params.planPath as string,
        planSummary: params.planSummary as string | undefined,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(workflow, null, 2) }],
      };
    },
  });

  api.registerTool({
    name: "set_task_subtasks",
    description:
      "Create the ordered execution subtasks for a complex HQ task after the plan has been recorded.",
    parameters: Type.Object({
      taskId: Type.String(),
      subtasks: Type.Array(
        Type.Object({
          title: Type.String(),
          instructions: Type.Optional(Type.String()),
          acceptanceCriteria: Type.Optional(Type.String()),
        })
      ),
    }),
    async execute(_id, params) {
      const subtasks = Array.isArray(params.subtasks)
        ? params.subtasks.map((subtask) => ({
            title: subtask.title as string,
            instructions: subtask.instructions as string | undefined,
            acceptanceCriteria: subtask.acceptanceCriteria as
              | string
              | undefined,
          }))
        : [];

      const result = await hq.call("task.workflow.setSubtasks", {
        taskId: params.taskId as string,
        subtasks,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  });

  api.registerTool({
    name: "update_task_subtask",
    description:
      "Update a complex-task subtask with status, worker summary, validator summary, or revision feedback.",
    parameters: Type.Object({
      taskId: Type.String(),
      subtaskId: numericIdSchema("Subtask ID"),
      status: Type.Optional(
        Type.Union([
          Type.Literal("pending"),
          Type.Literal("running"),
          Type.Literal("needs_revision"),
          Type.Literal("done"),
        ])
      ),
      latestWorkerSummary: Type.Optional(
        Type.Union([Type.String(), Type.Null()])
      ),
      latestValidatorSummary: Type.Optional(
        Type.Union([Type.String(), Type.Null()])
      ),
      latestFeedback: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    }),
    async execute(_id, params) {
      const result = await hq.call("task.workflow.updateSubtask", {
        taskId: params.taskId as string,
        subtaskId: requirePositiveInt(params.subtaskId, "subtaskId"),
        status: params.status as
          | "pending"
          | "running"
          | "needs_revision"
          | "done"
          | undefined,
        latestWorkerSummary: params.latestWorkerSummary as
          | string
          | null
          | undefined,
        latestValidatorSummary: params.latestValidatorSummary as
          | string
          | null
          | undefined,
        latestFeedback: params.latestFeedback as string | null | undefined,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  });

  api.registerTool({
    name: "link_task_session",
    description:
      "Link a root, planner, worker, or validator session to a complex HQ task so workflow state can be tracked in HQ.",
    parameters: Type.Object({
      taskId: Type.String(),
      sessionKey: Type.String(),
      role: Type.Union([
        Type.Literal("root"),
        Type.Literal("planner"),
        Type.Literal("worker"),
        Type.Literal("validator"),
      ]),
      subtaskId: Type.Optional(
        Type.Union([numericIdSchema("Subtask ID"), Type.Null()])
      ),
      agentId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      parentSessionKey: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      startedAtIso: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      completedAtIso: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      endedAtIso: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    }),
    async execute(_id, params) {
      const result = await hq.call("task.workflow.linkSession", {
        taskId: params.taskId as string,
        sessionKey: params.sessionKey as string,
        role: params.role as "root" | "planner" | "worker" | "validator",
        subtaskId:
          params.subtaskId === undefined || params.subtaskId === null
            ? params.subtaskId
            : requirePositiveInt(params.subtaskId, "subtaskId"),
        agentId: params.agentId as string | null | undefined,
        parentSessionKey: params.parentSessionKey as string | null | undefined,
        startedAt: toOptionalDate(params.startedAtIso),
        completedAt: toOptionalDate(params.completedAtIso),
        endedAt: toOptionalDate(params.endedAtIso),
      });

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  });

  api.registerTool({
    name: "complete_task_workflow",
    description:
      "Mark a complex HQ task workflow complete after every recorded subtask is done.",
    parameters: Type.Object({
      taskId: Type.String(),
    }),
    async execute(_id, params) {
      const result = await hq.call("task.workflow.complete", {
        taskId: params.taskId as string,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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
      const result = await hq.call("task.delete", {
        id: params.taskId as string,
      });
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
    description: "Delete a task comment by numeric comment ID.",
    parameters: Type.Object({
      commentId: numericIdSchema("Task comment ID"),
    }),
    async execute(_id, params) {
      const commentId = requirePositiveInt(params.commentId, "commentId");
      const result = await hq.call("task.comment.delete", {
        id: commentId,
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

  api.on("before_tool_call", (event, ctx) => {
    const nextParams = applyDefaultTaskAssignee({
      toolName: event.toolName,
      rawParams: event.params,
      agentId: ctx.agentId,
    });

    if (!nextParams) {
      return;
    }

    return { params: nextParams };
  });

  api.on("before_prompt_build", async (_event, ctx) => {
    if (config.autoEnrich === false || !ctx.sessionKey) {
      return;
    }

    const prependSystemContext = await maybeBuildWorkflowPromptContext({
      hq,
      sessionKey: ctx.sessionKey,
    });

    if (!prependSystemContext) {
      return;
    }

    return { prependSystemContext };
  });
}
