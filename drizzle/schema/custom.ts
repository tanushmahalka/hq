import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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

export const OBJECTIVE_STATUSES = ["active", "paused", "completed"] as const;

export type ObjectiveStatus = (typeof OBJECTIVE_STATUSES)[number];

export const OBJECTIVE_STATUS_LABELS: Record<ObjectiveStatus, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};

export const missionStatusEnum = pgEnum("mission_status", MISSION_STATUSES);
export const objectiveStatusEnum = pgEnum(
  "objective_status",
  OBJECTIVE_STATUSES
);

export const missions = pgTable("missions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  agentId: text("agent_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: missionStatusEnum("status").notNull().default("active"),
  organizationId: text("organization_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const objectives = pgTable("objectives", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  missionId: integer("mission_id")
    .notNull()
    .references(() => missions.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  hypothesis: text("hypothesis"),
  targetMetric: text("target_metric"),
  targetValue: text("target_value"),
  currentValue: text("current_value"),
  status: objectiveStatusEnum("status").notNull().default("active"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const missionsRelations = relations(missions, ({ many }) => ({
  objectives: many(objectives),
}));
