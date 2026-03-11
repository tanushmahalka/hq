import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  MISSION_STATUSES,
  OBJECTIVE_STATUSES,
  CAMPAIGN_STATUSES,
} from "./types.ts";

// -- Enums --

export const missionStatusEnum = pgEnum("mission_status", MISSION_STATUSES);
export const objectiveStatusEnum = pgEnum("objective_status", OBJECTIVE_STATUSES);
export const campaignStatusEnum = pgEnum("campaign_status", CAMPAIGN_STATUSES);

// -- Tables --

export const missions = pgTable("missions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: text("agent_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: missionStatusEnum("status").notNull().default("active"),
  organizationId: text("organization_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const objectives = pgTable("objectives", {
  id: uuid("id").primaryKey().defaultRandom(),
  missionId: uuid("mission_id")
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  objectiveId: uuid("objective_id")
    .notNull()
    .references(() => objectives.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  hypothesis: text("hypothesis"),
  learnings: text("learnings"),
  status: campaignStatusEnum("status").notNull().default("planned"),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// -- Relations --

export const missionsRelations = relations(missions, ({ many }) => ({
  objectives: many(objectives),
}));

export const objectivesRelations = relations(objectives, ({ one, many }) => ({
  mission: one(missions, {
    fields: [objectives.missionId],
    references: [missions.id],
  }),
  campaigns: many(campaigns),
}));

export const campaignsRelations = relations(campaigns, ({ one }) => ({
  objective: one(objectives, {
    fields: [campaigns.objectiveId],
    references: [objectives.id],
  }),
}));
