import { eq } from "drizzle-orm";
import {
  campaigns,
  objectives,
  missions,
} from "../../shared/custom/schema.ts";
import type { Database } from "../db/client.ts";

export interface MissionChain {
  mission: {
    id: string;
    agentId: string;
    title: string;
    description: string | null;
    status: string;
  };
  objective: {
    id: string;
    title: string;
    description: string | null;
    targetMetric: string | null;
    targetValue: string | null;
    currentValue: string | null;
    status: string;
    dueDate: Date | null;
  };
  campaign: {
    id: string;
    title: string;
    description: string | null;
    hypothesis: string | null;
    learnings: string | null;
    status: string;
  };
}

export async function fetchMissionChain(
  db: Database,
  campaignId: string
): Promise<MissionChain | null> {
  const campaign = (await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  })) as {
    id: string;
    objectiveId: string;
    title: string;
    description: string | null;
    hypothesis: string | null;
    learnings: string | null;
    status: string;
  } | null;

  if (!campaign) return null;

  const objective = (await db.query.objectives.findFirst({
    where: eq(objectives.id, campaign.objectiveId),
  })) as {
    id: string;
    missionId: string;
    title: string;
    description: string | null;
    targetMetric: string | null;
    targetValue: string | null;
    currentValue: string | null;
    status: string;
    dueDate: Date | null;
  } | null;

  if (!objective) return null;

  const mission = (await db.query.missions.findFirst({
    where: eq(missions.id, objective.missionId),
  })) as {
    id: string;
    agentId: string;
    title: string;
    description: string | null;
    status: string;
  } | null;

  if (!mission) return null;

  return {
    mission: {
      id: mission.id,
      agentId: mission.agentId,
      title: mission.title,
      description: mission.description,
      status: mission.status,
    },
    objective: {
      id: objective.id,
      title: objective.title,
      description: objective.description,
      targetMetric: objective.targetMetric,
      targetValue: objective.targetValue,
      currentValue: objective.currentValue,
      status: objective.status,
      dueDate: objective.dueDate,
    },
    campaign: {
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      hypothesis: campaign.hypothesis,
      learnings: campaign.learnings,
      status: campaign.status,
    },
  };
}

export function formatMissionContext(chain: MissionChain): string {
  const { mission, objective, campaign } = chain;

  const progress =
    objective.targetValue && objective.currentValue
      ? `${objective.currentValue} / ${objective.targetValue} (${Math.min(Math.round((Number(objective.currentValue) / Number(objective.targetValue)) * 100), 100)}%)`
      : "No metric data";

  const dueStr = objective.dueDate
    ? new Date(objective.dueDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "No due date";

  const lines = [
    `MISSION CONTEXT`,
    `${"=".repeat(40)}`,
    ``,
    `Mission: ${mission.title}`,
    `  Agent: ${mission.agentId} | Status: ${mission.status}`,
  ];

  if (mission.description) {
    lines.push(`  ${mission.description}`);
  }

  lines.push(
    ``,
    `Objective: ${objective.title}`,
    `  Progress: ${progress}`,
    `  Due: ${dueStr}`
  );

  if (objective.description) {
    lines.push(`  ${objective.description}`);
  }

  lines.push(``, `Campaign: ${campaign.title} (${campaign.status})`);

  if (campaign.hypothesis) {
    lines.push(`  Hypothesis: "${campaign.hypothesis}"`);
  }

  if (campaign.learnings) {
    lines.push(`  Learnings: ${campaign.learnings}`);
  }

  return lines.join("\n");
}
