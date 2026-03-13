import { pgTable, text, integer, timestamp, foreignKey, date, unique, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const imports = pgTable("imports", {
	id: integer("id").generatedByDefaultAsIdentity().primaryKey().notNull(),
	filename: text().notNull(),
	accountsImported: integer("accounts_imported").default(0).notNull(),
	contactsImported: integer("contacts_imported").default(0).notNull(),
	status: text().default('processing').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const callTasks = pgTable("call_tasks", {
	id: integer("id").generatedByDefaultAsIdentity().primaryKey().notNull(),
	contactId: integer("contact_id").notNull(),
	assignedTo: integer("assigned_to").notNull(),
	scheduledDate: date("scheduled_date").notNull(),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "call_tasks_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.assignedTo],
			foreignColumns: [teamMembers.id],
			name: "call_tasks_assigned_to_team_members_id_fk"
		}),
]);

export const callLogs = pgTable("call_logs", {
	id: integer("id").generatedByDefaultAsIdentity().primaryKey().notNull(),
	callTaskId: integer("call_task_id").notNull(),
	contactId: integer("contact_id").notNull(),
	teamMemberId: integer("team_member_id").notNull(),
	outcome: text().notNull(),
	durationSeconds: integer("duration_seconds"),
	notes: text(),
	calledAt: timestamp("called_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.callTaskId],
			foreignColumns: [callTasks.id],
			name: "call_logs_call_task_id_call_tasks_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "call_logs_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.teamMemberId],
			foreignColumns: [teamMembers.id],
			name: "call_logs_team_member_id_team_members_id_fk"
		}),
]);

export const contacts = pgTable("contacts", {
	id: integer("id").generatedByDefaultAsIdentity().primaryKey().notNull(),
	accountId: integer("account_id"),
	name: text().notNull(),
	title: text(),
	email: text(),
	phone: text(),
	linkedinUrl: text("linkedin_url"),
	status: text().default('new').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "contacts_account_id_accounts_id_fk"
		}),
]);

export const teamMembers = pgTable("team_members", {
	id: integer("id").generatedByDefaultAsIdentity().primaryKey().notNull(),
	name: text().notNull(),
	email: text(),
	dailyCallLimit: integer("daily_call_limit").default(25).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("team_members_email_unique").on(table.email),
]);

export const scrapeRuns = pgTable("scrape_runs", {
	id: integer("id").generatedByDefaultAsIdentity().primaryKey().notNull(),
	city: text(),
	country: text().notNull(),
	requestedCount: integer("requested_count"),
	jobsScraped: integer("jobs_scraped").default(0).notNull(),
	accountsCreated: integer("accounts_created").default(0).notNull(),
	status: text().default('pending').notNull(),
	triggerTaskId: text("trigger_task_id"),
	error: text(),
	startedAt: timestamp("started_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	jobTitle: text("job_title"),
	rawResponses: jsonb("raw_responses"),
});

export const accounts = pgTable("accounts", {
	id: integer("id").generatedByDefaultAsIdentity().primaryKey().notNull(),
	companyName: text("company_name").notNull(),
	website: text(),
	industry: text(),
	source: text(),
	status: text().default('new').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	category: text(),
	employeeCount: integer("employee_count"),
	disqualifiedReason: text("disqualified_reason"),
});

export const accountEnrichments = pgTable("account_enrichments", {
	id: integer("id").generatedByDefaultAsIdentity().primaryKey().notNull(),
	accountId: integer("account_id").notNull(),
	provider: text().notNull(),
	data: jsonb(),
	fetchedAt: timestamp("fetched_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "account_enrichments_account_id_accounts_id_fk"
		}),
]);

export const jobs = pgTable("jobs", {
	id: integer("id").generatedByDefaultAsIdentity().primaryKey().notNull(),
	accountId: integer("account_id"),
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
	source: text().default('naukri'),
	scrapeRunId: integer("scrape_run_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	externalCompanyId: text("external_company_id"),
}, (table) => [
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "jobs_account_id_accounts_id_fk"
		}),
	foreignKey({
			columns: [table.scrapeRunId],
			foreignColumns: [scrapeRuns.id],
			name: "jobs_scrape_run_id_scrape_runs_id_fk"
		}),
	unique("jobs_job_url_unique").on(table.jobUrl),
]);

export const accountEvents = pgTable("account_events", {
	id: integer("id").generatedByDefaultAsIdentity().primaryKey().notNull(),
	accountId: integer("account_id").notNull(),
	contactId: integer("contact_id"),
	teamMemberId: integer("team_member_id").notNull(),
	type: text().notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "account_events_account_id_accounts_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "account_events_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.teamMemberId],
			foreignColumns: [teamMembers.id],
			name: "account_events_team_member_id_team_members_id_fk"
		}),
]);
