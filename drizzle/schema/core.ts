import {
  pgTable,
  integer,
  text,
  boolean,
  timestamp,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { TASK_STATUSES } from "../../shared/types.ts";
import {
  TASK_SESSION_ROLES,
  TASK_SUBTASK_STATUSES,
  TASK_WORKFLOW_MODES,
  TASK_WORKFLOW_STATUSES,
} from "../../shared/task-workflow.ts";

export const taskStatusEnum = pgEnum("task_status", TASK_STATUSES);
export const taskWorkflowModeEnum = pgEnum(
  "task_workflow_mode",
  TASK_WORKFLOW_MODES,
);
export const taskWorkflowStatusEnum = pgEnum(
  "task_workflow_status",
  TASK_WORKFLOW_STATUSES,
);
export const taskSubtaskStatusEnum = pgEnum(
  "task_subtask_status",
  TASK_SUBTASK_STATUSES,
);
export const taskSessionRoleEnum = pgEnum(
  "task_session_role",
  TASK_SESSION_ROLES,
);

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("todo"),
  workflowMode: taskWorkflowModeEnum("workflow_mode")
    .notNull()
    .default("simple"),
  assignor: text("assignor"),
  assignee: text("assignee"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  urgent: boolean("urgent").notNull().default(false),
  important: boolean("important").notNull().default(false),
  campaignId: integer("campaign_id"),
  organizationId: text("organization_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const taskComments = pgTable("task_comments", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  author: text("author").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const taskWorkflows = pgTable("task_workflows", {
  taskId: text("task_id")
    .primaryKey()
    .references(() => tasks.id, { onDelete: "cascade" }),
  status: taskWorkflowStatusEnum("status")
    .notNull()
    .default("pending_assignment"),
  planPath: text("plan_path"),
  planSummary: text("plan_summary"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const taskSubtasks = pgTable(
  "task_subtasks",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    instructions: text("instructions"),
    acceptanceCriteria: text("acceptance_criteria"),
    status: taskSubtaskStatusEnum("status").notNull().default("pending"),
    latestWorkerSummary: text("latest_worker_summary"),
    latestValidatorSummary: text("latest_validator_summary"),
    latestFeedback: text("latest_feedback"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    taskPositionUnique: unique("task_subtasks_task_id_position_unique").on(
      table.taskId,
      table.position,
    ),
  }),
);

export const taskSessions = pgTable("task_sessions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  subtaskId: integer("subtask_id").references(() => taskSubtasks.id, {
    onDelete: "set null",
  }),
  sessionKey: text("session_key").notNull().unique(),
  role: taskSessionRoleEnum("role").notNull(),
  agentId: text("agent_id"),
  parentSessionKey: text("parent_session_key"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const agentDatabases = pgTable("agent_databases", {
  agentId: text("agent_id").primaryKey(),
  dbUrl: text("db_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const tasksRelations = relations(tasks, ({ many, one }) => ({
  comments: many(taskComments),
  workflow: one(taskWorkflows, {
    fields: [tasks.id],
    references: [taskWorkflows.taskId],
  }),
  subtasks: many(taskSubtasks),
  sessions: many(taskSessions),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskComments.taskId],
    references: [tasks.id],
  }),
}));

export const taskWorkflowsRelations = relations(taskWorkflows, ({ one }) => ({
  task: one(tasks, {
    fields: [taskWorkflows.taskId],
    references: [tasks.id],
  }),
}));

export const taskSubtasksRelations = relations(taskSubtasks, ({ one, many }) => ({
  task: one(tasks, {
    fields: [taskSubtasks.taskId],
    references: [tasks.id],
  }),
  sessions: many(taskSessions),
}));

export const taskSessionsRelations = relations(taskSessions, ({ one }) => ({
  task: one(tasks, {
    fields: [taskSessions.taskId],
    references: [tasks.id],
  }),
  subtask: one(taskSubtasks, {
    fields: [taskSessions.subtaskId],
    references: [taskSubtasks.id],
  }),
}));
