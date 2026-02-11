import { relations } from "drizzle-orm/relations";
import { contacts, callTasks, teamMembers, callLogs, accounts, accountEnrichments, jobs, scrapeRuns, accountEvents } from "./schema";

export const callTasksRelations = relations(callTasks, ({one, many}) => ({
	contact: one(contacts, {
		fields: [callTasks.contactId],
		references: [contacts.id]
	}),
	teamMember: one(teamMembers, {
		fields: [callTasks.assignedTo],
		references: [teamMembers.id]
	}),
	callLogs: many(callLogs),
}));

export const contactsRelations = relations(contacts, ({one, many}) => ({
	callTasks: many(callTasks),
	callLogs: many(callLogs),
	account: one(accounts, {
		fields: [contacts.accountId],
		references: [accounts.id]
	}),
	accountEvents: many(accountEvents),
}));

export const teamMembersRelations = relations(teamMembers, ({many}) => ({
	callTasks: many(callTasks),
	callLogs: many(callLogs),
	accountEvents: many(accountEvents),
}));

export const callLogsRelations = relations(callLogs, ({one}) => ({
	callTask: one(callTasks, {
		fields: [callLogs.callTaskId],
		references: [callTasks.id]
	}),
	contact: one(contacts, {
		fields: [callLogs.contactId],
		references: [contacts.id]
	}),
	teamMember: one(teamMembers, {
		fields: [callLogs.teamMemberId],
		references: [teamMembers.id]
	}),
}));

export const accountsRelations = relations(accounts, ({many}) => ({
	contacts: many(contacts),
	accountEnrichments: many(accountEnrichments),
	jobs: many(jobs),
	accountEvents: many(accountEvents),
}));

export const accountEnrichmentsRelations = relations(accountEnrichments, ({one}) => ({
	account: one(accounts, {
		fields: [accountEnrichments.accountId],
		references: [accounts.id]
	}),
}));

export const jobsRelations = relations(jobs, ({one}) => ({
	account: one(accounts, {
		fields: [jobs.accountId],
		references: [accounts.id]
	}),
	scrapeRun: one(scrapeRuns, {
		fields: [jobs.scrapeRunId],
		references: [scrapeRuns.id]
	}),
}));

export const scrapeRunsRelations = relations(scrapeRuns, ({many}) => ({
	jobs: many(jobs),
}));

export const accountEventsRelations = relations(accountEvents, ({one}) => ({
	account: one(accounts, {
		fields: [accountEvents.accountId],
		references: [accounts.id]
	}),
	contact: one(contacts, {
		fields: [accountEvents.contactId],
		references: [contacts.id]
	}),
	teamMember: one(teamMembers, {
		fields: [accountEvents.teamMemberId],
		references: [teamMembers.id]
	}),
}));