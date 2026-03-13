import {
  boolean,
  date,
  foreignKey,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const campaignStatus = pgEnum("campaign_status", [
  "planned",
  "active",
  "paused",
  "completed",
  "failed",
]);
export const missionStatus = pgEnum("mission_status", [
  "active",
  "paused",
  "completed",
  "archived",
]);
export const objectiveStatus = pgEnum("objective_status", ["active", "paused", "completed"]);
export const taskStatus = pgEnum("task_status", ["todo", "doing", "stuck", "done"]);

export const agentDatabases = pgTable("agent_databases", {
  agentId: text("agent_id").primaryKey().notNull(),
  dbUrl: text("db_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

export const user = pgTable(
  "user",
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
    role: text().default("user"),
    banned: boolean().default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { mode: "string" }),
  },
  (table) => [unique("user_email_unique").on(table.email)],
);

export const organization = pgTable(
  "organization",
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    slug: text(),
    logo: text(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
    metadata: text(),
  },
  (table) => [unique("organization_slug_unique").on(table.slug)],
);

export const missions = pgTable("missions", {
  agentId: text("agent_id").notNull(),
  title: text().notNull(),
  description: text(),
  status: missionStatus().default("active").notNull(),
  organizationId: text("organization_id"),
  metadata: jsonb(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  id: integer()
    .primaryKey()
    .generatedByDefaultAsIdentity({
      name: "missions_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
});

export const objectives = pgTable(
  "objectives",
  {
    title: text().notNull(),
    description: text(),
    hypothesis: text(),
    targetMetric: text("target_metric"),
    targetValue: text("target_value"),
    currentValue: text("current_value"),
    status: objectiveStatus().default("active").notNull(),
    dueDate: timestamp("due_date", { withTimezone: true, mode: "string" }),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "objectives_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    missionId: integer("mission_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.missionId],
      foreignColumns: [missions.id],
      name: "objectives_mission_id_missions_id_fk",
    }).onDelete("cascade"),
  ],
);

export const campaigns = pgTable(
  "campaigns",
  {
    title: text().notNull(),
    description: text(),
    hypothesis: text(),
    learnings: text(),
    status: campaignStatus().default("planned").notNull(),
    startDate: timestamp("start_date", { withTimezone: true, mode: "string" }),
    endDate: timestamp("end_date", { withTimezone: true, mode: "string" }),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "campaigns_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    objectiveId: integer("objective_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.objectiveId],
      foreignColumns: [objectives.id],
      name: "campaigns_objective_id_objectives_id_fk",
    }).onDelete("cascade"),
  ],
);

export const tasks = pgTable("tasks", {
  id: text().primaryKey().notNull(),
  title: text().notNull(),
  description: text(),
  status: taskStatus().default("todo").notNull(),
  assignor: text(),
  assignee: text(),
  dueDate: timestamp("due_date", { withTimezone: true, mode: "string" }),
  urgent: boolean().default(false).notNull(),
  important: boolean().default(false).notNull(),
  organizationId: text("organization_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  campaignId: integer("campaign_id"),
});

export const taskComments = pgTable(
  "task_comments",
  {
    taskId: text("task_id").notNull(),
    author: text().notNull(),
    content: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "task_comments_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
  },
  (table) => [
    foreignKey({
      columns: [table.taskId],
      foreignColumns: [tasks.id],
      name: "task_comments_task_id_tasks_id_fk",
    }).onDelete("cascade"),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey().notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: "string" }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: "string" }),
    scope: text(),
    password: text(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "account_user_id_user_id_fk",
    }).onDelete("cascade"),
  ],
);

export const apikey = pgTable(
  "apikey",
  {
    id: text().primaryKey().notNull(),
    name: text(),
    start: text(),
    prefix: text(),
    key: text().notNull(),
    userId: text("user_id").notNull(),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at", { mode: "string" }),
    enabled: boolean().default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").default(false),
    rateLimitTimeWindow: integer("rate_limit_time_window"),
    rateLimitMax: integer("rate_limit_max"),
    requestCount: integer("request_count").default(0),
    remaining: integer(),
    lastRequest: timestamp("last_request", { mode: "string" }),
    expiresAt: timestamp("expires_at", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
    permissions: text(),
    metadata: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "apikey_user_id_user_id_fk",
    }).onDelete("cascade"),
  ],
);

export const member = pgTable(
  "member",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id").notNull(),
    userId: text("user_id").notNull(),
    role: text().default("member").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organization.id],
      name: "member_organization_id_organization_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "member_user_id_user_id_fk",
    }).onDelete("cascade"),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text().primaryKey().notNull(),
    expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
    token: text().notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull(),
    activeOrganizationId: text("active_organization_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "session_user_id_user_id_fk",
    }).onDelete("cascade"),
    unique("session_token_unique").on(table.token),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id").notNull(),
    email: text().notNull(),
    role: text(),
    status: text().default("pending").notNull(),
    expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
    inviterId: text("inviter_id").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organization.id],
      name: "invitation_organization_id_organization_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.inviterId],
      foreignColumns: [user.id],
      name: "invitation_inviter_id_user_id_fk",
    }).onDelete("cascade"),
  ],
);

export const verification = pgTable("verification", {
  id: text().primaryKey().notNull(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
});

export const imports = pgTable("imports", {
  filename: text().notNull(),
  accountsImported: integer("accounts_imported").default(0).notNull(),
  contactsImported: integer("contacts_imported").default(0).notNull(),
  status: text().default("processing").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  id: integer()
    .primaryKey()
    .generatedByDefaultAsIdentity({
      name: "imports_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
});

export const accounts = pgTable("accounts", {
  companyName: text("company_name").notNull(),
  website: text(),
  industry: text(),
  source: text(),
  status: text().default("new").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  category: text(),
  employeeCount: integer("employee_count"),
  disqualifiedReason: text("disqualified_reason"),
  id: integer()
    .primaryKey()
    .generatedByDefaultAsIdentity({
      name: "accounts_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
});

export const teamMembers = pgTable(
  "team_members",
  {
    name: text().notNull(),
    email: text(),
    dailyCallLimit: integer("daily_call_limit").default(25).notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "team_members_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
  },
  (table) => [unique("team_members_email_unique").on(table.email)],
);

export const scrapeRuns = pgTable("scrape_runs", {
  city: text(),
  country: text().notNull(),
  requestedCount: integer("requested_count"),
  jobsScraped: integer("jobs_scraped").default(0).notNull(),
  accountsCreated: integer("accounts_created").default(0).notNull(),
  status: text().default("pending").notNull(),
  triggerTaskId: text("trigger_task_id"),
  error: text(),
  startedAt: timestamp("started_at", { mode: "string" }),
  completedAt: timestamp("completed_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  jobTitle: text("job_title"),
  rawResponses: jsonb("raw_responses"),
  id: integer()
    .primaryKey()
    .generatedByDefaultAsIdentity({
      name: "scrape_runs_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
});

export const contacts = pgTable(
  "contacts",
  {
    name: text().notNull(),
    title: text(),
    email: text(),
    phone: text(),
    linkedinUrl: text("linkedin_url"),
    status: text().default("new").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "contacts_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    accountId: integer("account_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: "contacts_account_id_accounts_id_fk",
    }),
  ],
);

export const callTasks = pgTable(
  "call_tasks",
  {
    scheduledDate: date("scheduled_date").notNull(),
    status: text().default("pending").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "call_tasks_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    assignedTo: integer("assigned_to").notNull(),
    contactId: integer("contact_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.assignedTo],
      foreignColumns: [teamMembers.id],
      name: "call_tasks_assigned_to_team_members_id_fk",
    }),
    foreignKey({
      columns: [table.contactId],
      foreignColumns: [contacts.id],
      name: "call_tasks_contact_id_contacts_id_fk",
    }),
  ],
);

export const accountEnrichments = pgTable(
  "account_enrichments",
  {
    provider: text().notNull(),
    data: jsonb(),
    fetchedAt: timestamp("fetched_at", { mode: "string" }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "account_enrichments_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    accountId: integer("account_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: "account_enrichments_account_id_accounts_id_fk",
    }),
  ],
);

export const accountEvents = pgTable(
  "account_events",
  {
    type: text().notNull(),
    notes: text(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "account_events_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    accountId: integer("account_id").notNull(),
    contactId: integer("contact_id"),
    teamMemberId: integer("team_member_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: "account_events_account_id_accounts_id_fk",
    }),
    foreignKey({
      columns: [table.contactId],
      foreignColumns: [contacts.id],
      name: "account_events_contact_id_contacts_id_fk",
    }),
    foreignKey({
      columns: [table.teamMemberId],
      foreignColumns: [teamMembers.id],
      name: "account_events_team_member_id_team_members_id_fk",
    }),
  ],
);

export const callLogs = pgTable(
  "call_logs",
  {
    outcome: text().notNull(),
    durationSeconds: integer("duration_seconds"),
    notes: text(),
    calledAt: timestamp("called_at", { mode: "string" }).defaultNow().notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "call_logs_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    callTaskId: integer("call_task_id").notNull(),
    contactId: integer("contact_id").notNull(),
    teamMemberId: integer("team_member_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.callTaskId],
      foreignColumns: [callTasks.id],
      name: "call_logs_call_task_id_call_tasks_id_fk",
    }),
    foreignKey({
      columns: [table.contactId],
      foreignColumns: [contacts.id],
      name: "call_logs_contact_id_contacts_id_fk",
    }),
    foreignKey({
      columns: [table.teamMemberId],
      foreignColumns: [teamMembers.id],
      name: "call_logs_team_member_id_team_members_id_fk",
    }),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    title: text().notNull(),
    companyName: text("company_name").notNull(),
    location: text(),
    salaryRange: text("salary_range"),
    experience: text(),
    jobUrl: text("job_url"),
    description: text(),
    skills: text(),
    jobType: text("job_type"),
    postedDate: text("posted_date"),
    recruiterName: text("recruiter_name"),
    recruiterEmail: text("recruiter_email"),
    recruiterPhone: text("recruiter_phone"),
    companyRating: text("company_rating"),
    source: text().default("naukri"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
    externalCompanyId: text("external_company_id"),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "jobs_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    accountId: integer("account_id"),
    scrapeRunId: integer("scrape_run_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: "jobs_account_id_accounts_id_fk",
    }),
    foreignKey({
      columns: [table.scrapeRunId],
      foreignColumns: [scrapeRuns.id],
      name: "jobs_scrape_run_id_scrape_runs_id_fk",
    }),
    unique("jobs_job_url_unique").on(table.jobUrl),
  ],
);
