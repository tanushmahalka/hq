import type { MissionChain } from "./hq-client";

export function formatMissionContext(chain: MissionChain): string {
  const { mission, objective, campaign } = chain;

  const progress = objective.targetValue && objective.currentValue
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
    `  Agent: ${mission.agentId} | Autonomy: ${mission.autonomyLevel} | Status: ${mission.status}`,
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

  lines.push(
    ``,
    `Campaign: ${campaign.title} (${campaign.status})`,
  );

  if (campaign.hypothesis) {
    lines.push(`  Hypothesis: "${campaign.hypothesis}"`);
  }

  if (campaign.learnings) {
    lines.push(`  Learnings: ${campaign.learnings}`);
  }

  lines.push(
    ``,
    `This task is part of the above campaign. Read the objective and hypothesis`,
    `before executing. After completing the task, consider using:`,
    `  - update_campaign_status — if campaign is done/failed`,
    `  - update_objective_metric — if you can measure progress`,
    `  - log_campaign_learnings — to record what you learned`,
  );

  return lines.join("\n");
}
