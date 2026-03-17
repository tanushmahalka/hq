import {
  pgTable,
  text,
  integer,
  timestamp,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { missions, objectives } from "./custom.ts";

export const marketingAssetTypeEnum = pgEnum("marketing_asset_type", [
  "ebook",
  "email",
  "landing_page",
  "social",
]);
export const marketingAssetStatusEnum = pgEnum("marketing_asset_status", [
  "draft",
  "published",
  "archived",
]);
export const marketingAssetRevisionSourceEnum = pgEnum(
  "marketing_asset_revision_source",
  ["user", "agent", "cli"],
);

export const marketingAssets = pgTable(
  "marketing_assets",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    organizationId: text("organization_id").notNull(),
    assetType: marketingAssetTypeEnum("asset_type").notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    status: marketingAssetStatusEnum("status").notNull().default("draft"),
    currentHtml: text("current_html").notNull(),
    currentVersion: integer("current_version").notNull().default(1),
    storagePath: text("storage_path"),
    lastUpdatedBy: text("last_updated_by"),
    lastUpdateSource: marketingAssetRevisionSourceEnum("last_update_source")
      .notNull()
      .default("user"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    organizationTypeSlugUnique: unique("marketing_assets_org_type_slug_unique").on(
      table.organizationId,
      table.assetType,
      table.slug,
    ),
  }),
);

export const marketingAssetRevisions = pgTable(
  "marketing_asset_revisions",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    assetId: integer("asset_id")
      .notNull()
      .references(() => marketingAssets.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    assetType: marketingAssetTypeEnum("asset_type").notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    status: marketingAssetStatusEnum("status").notNull(),
    html: text("html").notNull(),
    summary: text("summary"),
    updatedBy: text("updated_by"),
    source: marketingAssetRevisionSourceEnum("source").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    assetVersionUnique: unique("marketing_asset_revisions_asset_version_unique").on(
      table.assetId,
      table.version,
    ),
  }),
);

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

export const marketingAssetsRelations = relations(
  marketingAssets,
  ({ many }) => ({
    revisions: many(marketingAssetRevisions),
  }),
);

export const marketingAssetRevisionsRelations = relations(
  marketingAssetRevisions,
  ({ one }) => ({
    asset: one(marketingAssets, {
      fields: [marketingAssetRevisions.assetId],
      references: [marketingAssets.id],
    }),
  }),
);

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
