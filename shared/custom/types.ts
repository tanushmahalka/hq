// Mission framework enums and label maps

export const MISSION_STATUSES = [
  "active",
  "paused",
  "completed",
  "archived",
] as const;

export type MissionStatus = (typeof MISSION_STATUSES)[number];

export const MISSION_STATUS_LABELS: Record<MissionStatus, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};

export const AUTONOMY_LEVELS = [
  "notify",
  "suggest",
  "act-and-report",
  "full-auto",
] as const;

export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export const AUTONOMY_LEVEL_LABELS: Record<AutonomyLevel, string> = {
  notify: "Notify",
  suggest: "Suggest",
  "act-and-report": "Act & Report",
  "full-auto": "Full Auto",
};

export const OBJECTIVE_STATUSES = [
  "active",
  "paused",
  "completed",
] as const;

export type ObjectiveStatus = (typeof OBJECTIVE_STATUSES)[number];

export const OBJECTIVE_STATUS_LABELS: Record<ObjectiveStatus, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};

export const CAMPAIGN_STATUSES = [
  "planned",
  "active",
  "paused",
  "completed",
  "failed",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  planned: "Planned",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  failed: "Failed",
};
