import {
  index,
  uniqueIndex,
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

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

export type AgentListJsonSchema = Record<string, unknown>;
export type AgentListRowData = Record<string, unknown>;

export const agentLists = pgTable(
  "agent_lists",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    title: text("title").notNull(),
    description: text("description"),
    jsonSchema: jsonb("json_schema").$type<AgentListJsonSchema>().notNull(),
    agentId: text("agent_id"),
    organizationId: text("organization_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    agentListsAgentIdx: index("agent_lists_agent_idx").on(table.agentId),
    agentListsOrganizationIdx: index("agent_lists_organization_idx").on(
      table.organizationId,
    ),
  }),
);

export const agentListRows = pgTable(
  "agent_list_rows",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    listId: integer("list_id")
      .notNull()
      .references(() => agentLists.id, { onDelete: "cascade" }),
    data: jsonb("data").$type<AgentListRowData>().notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    agentListRowsListIdx: index("agent_list_rows_list_idx").on(table.listId),
    agentListRowsListSortIdx: index("agent_list_rows_list_sort_idx").on(
      table.listId,
      table.sortOrder,
    ),
  }),
);

export const missionsRelations = relations(missions, ({ many }) => ({
  objectives: many(objectives),
}));

export const agentListsRelations = relations(agentLists, ({ many }) => ({
  rows: many(agentListRows),
}));

export const agentListRowsRelations = relations(agentListRows, ({ one }) => ({
  list: one(agentLists, {
    fields: [agentListRows.listId],
    references: [agentLists.id],
  }),
}));

// --- FindAll runs (AI List Builder) ---
// A FindAll run wraps a Parallel.ai FindAll search. Each run owns one
// agent_lists record; matched candidates are persisted as agent_list_rows so
// the result is an ordinary list. This table tracks the run lifecycle so a
// stream can be resumed and reconciled after the browser disconnects.

export const FINDALL_STATUSES = [
  "running",
  "completed",
  "cancelled",
  "failed",
] as const;
export type FindallStatus = (typeof FINDALL_STATUSES)[number];
export const findallStatusEnum = pgEnum("findall_status", FINDALL_STATUSES);

export const FINDALL_GENERATORS = ["preview", "base", "core", "pro"] as const;
export type FindallGenerator = (typeof FINDALL_GENERATORS)[number];

/** One {name, description} entry — a Parallel match_condition or an enrichment column. */
export type FindallMatchCondition = { name: string; description: string };
export type FindallEnrichment = {
  name: string;
  description: string;
  type?: "string" | "number" | "boolean";
  format?: "uri";
};
/** Mirrors Parallel run status.metrics. */
export type FindallMetrics = {
  generated_candidates_count?: number;
  matched_candidates_count?: number;
  termination_reason?: string;
};

export const findallRuns = pgTable(
  "findall_runs",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    findallId: text("findall_id").notNull(),
    listId: integer("list_id")
      .notNull()
      .references(() => agentLists.id, { onDelete: "cascade" }),
    objective: text("objective").notNull(),
    entityType: text("entity_type"),
    matchConditions: jsonb("match_conditions")
      .$type<FindallMatchCondition[]>()
      .notNull(),
    enrichments: jsonb("enrichments")
      .$type<FindallEnrichment[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    generator: text("generator")
      .$type<FindallGenerator>()
      .notNull()
      .default("core"),
    matchLimit: integer("match_limit").notNull().default(25),
    status: findallStatusEnum("status").notNull().default("running"),
    metrics: jsonb("metrics").$type<FindallMetrics>(),
    lastEventId: text("last_event_id"),
    agentId: text("agent_id"),
    organizationId: text("organization_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    findallRunsFindallIdx: uniqueIndex("findall_runs_findall_id_idx").on(
      table.findallId,
    ),
    findallRunsListIdx: index("findall_runs_list_idx").on(table.listId),
    findallRunsOrganizationIdx: index("findall_runs_organization_idx").on(
      table.organizationId,
    ),
  }),
);

export const findallRunsRelations = relations(findallRuns, ({ one }) => ({
  list: one(agentLists, {
    fields: [findallRuns.listId],
    references: [agentLists.id],
  }),
}));
