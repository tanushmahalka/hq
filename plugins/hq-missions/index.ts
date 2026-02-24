import { Type } from "@sinclair/typebox";
import { createHQClient, type HQClient } from "./hq-client";
import { formatMissionContext } from "./format-context";

interface PluginAPI {
  config: { hqApiUrl: string; hqApiToken: string; autoEnrich?: boolean };
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

export default function register(api: PluginAPI) {
  const config = api.config;
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
        params.agentId ? { agentId: params.agentId as string } : undefined
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
    name: "list_campaign_tasks",
    description:
      "List all tasks linked to a specific campaign, showing their status and progress.",
    parameters: Type.Object({
      campaignId: Type.String(),
    }),
    async execute(_id, params) {
      const tasks = (await hq.call<
        { campaignId?: string; id: string; title: string; status: string }[]
      >("task.list")) as {
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

  // ── Gateway RPC ──

  api.registerGatewayMethod("missions.sync", async ({ params, respond }) => {
    const { agentId } = params as { agentId?: string };
    const briefing = await hq.call(
      "custom.mission.list",
      agentId ? { agentId } : undefined
    );
    respond(true, { ok: true, missions: briefing });
  });

  api.registerGatewayMethod("missions.status", async ({ respond }) => {
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
