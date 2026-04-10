import {
  pgTable,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { missions, objectives } from "./custom.ts";

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

export const campaignStatusEnum = pgEnum("campaign_status", CAMPAIGN_STATUSES);

export const campaigns = pgTable("campaigns", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  objectiveId: integer("objective_id")
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const campaignsRelations = relations(campaigns, ({ one }) => ({
  objective: one(objectives, {
    fields: [campaigns.objectiveId],
    references: [objectives.id],
  }),
}));

export const objectivesRelations = relations(objectives, ({ one, many }) => ({
  mission: one(missions, {
    fields: [objectives.missionId],
    references: [missions.id],
  }),
  campaigns: many(campaigns),
}));
