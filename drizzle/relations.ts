import { relations } from "drizzle-orm/relations";
import { user, account, apikey, organization, member, session, invitation, tasks, taskComments, accounts, accountEnrichments, accountEvents, contacts, teamMembers, pages, analyticsDaily, sites, assets, backlinkSources, competitorBacklinkSources, brandMentions, businessProfiles, callTasks, callLogs, objectives, campaigns, siteCompetitors, competitorDomainFootprints, competitorRankedKeywords, crawlRuns, crawlPageFacts, internalLinks, jobs, scrapeRuns, missions, outreachProspects, linkOpportunities, outreachContacts, outreachThreads, outreachMessages, queryClusters, pageClusterTargets, queries, reviews, searchConsoleDaily, siteDomainFootprints, siteBacklinkFootprints, competitorBacklinkFootprints } from "./schema";

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	accounts: many(account),
	apikeys: many(apikey),
	members: many(member),
	sessions: many(session),
	invitations: many(invitation),
}));

export const apikeyRelations = relations(apikey, ({one}) => ({
	user: one(user, {
		fields: [apikey.userId],
		references: [user.id]
	}),
}));

export const memberRelations = relations(member, ({one}) => ({
	organization: one(organization, {
		fields: [member.organizationId],
		references: [organization.id]
	}),
	user: one(user, {
		fields: [member.userId],
		references: [user.id]
	}),
}));

export const organizationRelations = relations(organization, ({many}) => ({
	members: many(member),
	invitations: many(invitation),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const invitationRelations = relations(invitation, ({one}) => ({
	organization: one(organization, {
		fields: [invitation.organizationId],
		references: [organization.id]
	}),
	user: one(user, {
		fields: [invitation.inviterId],
		references: [user.id]
	}),
}));

export const taskCommentsRelations = relations(taskComments, ({one}) => ({
	task: one(tasks, {
		fields: [taskComments.taskId],
		references: [tasks.id]
	}),
}));

export const tasksRelations = relations(tasks, ({many}) => ({
	taskComments: many(taskComments),
}));

export const accountEnrichmentsRelations = relations(accountEnrichments, ({one}) => ({
	account: one(accounts, {
		fields: [accountEnrichments.accountId],
		references: [accounts.id]
	}),
}));

export const accountsRelations = relations(accounts, ({many}) => ({
	accountEnrichments: many(accountEnrichments),
	accountEvents: many(accountEvents),
	contacts: many(contacts),
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

export const contactsRelations = relations(contacts, ({one, many}) => ({
	accountEvents: many(accountEvents),
	callLogs: many(callLogs),
	callTasks: many(callTasks),
	account: one(accounts, {
		fields: [contacts.accountId],
		references: [accounts.id]
	}),
}));

export const teamMembersRelations = relations(teamMembers, ({many}) => ({
	accountEvents: many(accountEvents),
	callLogs: many(callLogs),
	callTasks: many(callTasks),
}));

export const analyticsDailyRelations = relations(analyticsDaily, ({one}) => ({
	page: one(pages, {
		fields: [analyticsDaily.pageId],
		references: [pages.id]
	}),
	site: one(sites, {
		fields: [analyticsDaily.siteId],
		references: [sites.id]
	}),
}));

export const pagesRelations = relations(pages, ({one, many}) => ({
	analyticsDailies: many(analyticsDaily),
	assets: many(assets),
	backlinkSources: many(backlinkSources),
	crawlPageFacts: many(crawlPageFacts),
	internalLinks_sourcePageId: many(internalLinks, {
		relationName: "internalLinks_sourcePageId_pages_id"
	}),
	internalLinks_targetPageId: many(internalLinks, {
		relationName: "internalLinks_targetPageId_pages_id"
	}),
	linkOpportunities: many(linkOpportunities),
	pageClusterTargets: many(pageClusterTargets),
	site: one(sites, {
		fields: [pages.siteId],
		references: [sites.id]
	}),
	searchConsoleDailies: many(searchConsoleDaily),
}));

export const sitesRelations = relations(sites, ({many}) => ({
	analyticsDailies: many(analyticsDaily),
	assets: many(assets),
	backlinkSources: many(backlinkSources),
	brandMentions: many(brandMentions),
	businessProfiles: many(businessProfiles),
	crawlRuns: many(crawlRuns),
	internalLinks: many(internalLinks),
	linkOpportunities: many(linkOpportunities),
	outreachProspects: many(outreachProspects),
	outreachThreads: many(outreachThreads),
	pages: many(pages),
	queryClusters: many(queryClusters),
	reviews: many(reviews),
	searchConsoleDailies: many(searchConsoleDaily),
	siteBacklinkFootprints: many(siteBacklinkFootprints),
	siteCompetitors: many(siteCompetitors),
	siteDomainFootprints: many(siteDomainFootprints),
}));

export const assetsRelations = relations(assets, ({one}) => ({
	page: one(pages, {
		fields: [assets.pageId],
		references: [pages.id]
	}),
	site: one(sites, {
		fields: [assets.siteId],
		references: [sites.id]
	}),
}));

export const backlinkSourcesRelations = relations(backlinkSources, ({one, many}) => ({
	site: one(sites, {
		fields: [backlinkSources.siteId],
		references: [sites.id]
	}),
	page: one(pages, {
		fields: [backlinkSources.targetPageId],
		references: [pages.id]
	}),
	outreachThreads: many(outreachThreads),
}));

export const competitorBacklinkSourcesRelations = relations(competitorBacklinkSources, ({one}) => ({
	siteCompetitor: one(siteCompetitors, {
		fields: [competitorBacklinkSources.siteCompetitorId],
		references: [siteCompetitors.id]
	}),
}));

export const brandMentionsRelations = relations(brandMentions, ({one, many}) => ({
	linkOpportunities: many(linkOpportunities),
	site: one(sites, {
		fields: [brandMentions.siteId],
		references: [sites.id]
	}),
}));

export const businessProfilesRelations = relations(businessProfiles, ({one}) => ({
	site: one(sites, {
		fields: [businessProfiles.siteId],
		references: [sites.id]
	}),
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

export const callTasksRelations = relations(callTasks, ({one, many}) => ({
	callLogs: many(callLogs),
	teamMember: one(teamMembers, {
		fields: [callTasks.assignedTo],
		references: [teamMembers.id]
	}),
	contact: one(contacts, {
		fields: [callTasks.contactId],
		references: [contacts.id]
	}),
}));

export const campaignsRelations = relations(campaigns, ({one}) => ({
	objective: one(objectives, {
		fields: [campaigns.objectiveId],
		references: [objectives.id]
	}),
}));

export const objectivesRelations = relations(objectives, ({one, many}) => ({
	campaigns: many(campaigns),
	mission: one(missions, {
		fields: [objectives.missionId],
		references: [missions.id]
	}),
}));

export const competitorDomainFootprintsRelations = relations(competitorDomainFootprints, ({one}) => ({
	siteCompetitor: one(siteCompetitors, {
		fields: [competitorDomainFootprints.siteCompetitorId],
		references: [siteCompetitors.id]
	}),
}));

export const siteCompetitorsRelations = relations(siteCompetitors, ({one, many}) => ({
	competitorBacklinkSources: many(competitorBacklinkSources),
	competitorBacklinkFootprints: many(competitorBacklinkFootprints),
	competitorDomainFootprints: many(competitorDomainFootprints),
	competitorRankedKeywords: many(competitorRankedKeywords),
	linkOpportunities: many(linkOpportunities),
	site: one(sites, {
		fields: [siteCompetitors.siteId],
		references: [sites.id]
	}),
}));

export const competitorRankedKeywordsRelations = relations(competitorRankedKeywords, ({one}) => ({
	siteCompetitor: one(siteCompetitors, {
		fields: [competitorRankedKeywords.siteCompetitorId],
		references: [siteCompetitors.id]
	}),
}));

export const crawlPageFactsRelations = relations(crawlPageFacts, ({one}) => ({
	crawlRun: one(crawlRuns, {
		fields: [crawlPageFacts.crawlRunId],
		references: [crawlRuns.id]
	}),
	page: one(pages, {
		fields: [crawlPageFacts.pageId],
		references: [pages.id]
	}),
}));

export const crawlRunsRelations = relations(crawlRuns, ({one, many}) => ({
	crawlPageFacts: many(crawlPageFacts),
	site: one(sites, {
		fields: [crawlRuns.siteId],
		references: [sites.id]
	}),
}));

export const internalLinksRelations = relations(internalLinks, ({one}) => ({
	site: one(sites, {
		fields: [internalLinks.siteId],
		references: [sites.id]
	}),
	page_sourcePageId: one(pages, {
		fields: [internalLinks.sourcePageId],
		references: [pages.id],
		relationName: "internalLinks_sourcePageId_pages_id"
	}),
	page_targetPageId: one(pages, {
		fields: [internalLinks.targetPageId],
		references: [pages.id],
		relationName: "internalLinks_targetPageId_pages_id"
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

export const missionsRelations = relations(missions, ({many}) => ({
	objectives: many(objectives),
}));

export const outreachProspectsRelations = relations(outreachProspects, ({one, many}) => ({
	linkOpportunities: many(linkOpportunities),
	outreachContacts: many(outreachContacts),
	outreachThreads: many(outreachThreads),
	site: one(sites, {
		fields: [outreachProspects.siteId],
		references: [sites.id]
	}),
}));

export const linkOpportunitiesRelations = relations(linkOpportunities, ({one, many}) => ({
	brandMention: one(brandMentions, {
		fields: [linkOpportunities.brandMentionId],
		references: [brandMentions.id]
	}),
	outreachProspect: one(outreachProspects, {
		fields: [linkOpportunities.prospectId],
		references: [outreachProspects.id]
	}),
	page: one(pages, {
		fields: [linkOpportunities.targetPageId],
		references: [pages.id]
	}),
	site: one(sites, {
		fields: [linkOpportunities.siteId],
		references: [sites.id]
	}),
	siteCompetitor: one(siteCompetitors, {
		fields: [linkOpportunities.siteCompetitorId],
		references: [siteCompetitors.id]
	}),
	outreachThreads: many(outreachThreads),
}));

export const outreachContactsRelations = relations(outreachContacts, ({one, many}) => ({
	primaryThreads: many(outreachThreads),
	outreachProspect: one(outreachProspects, {
		fields: [outreachContacts.prospectId],
		references: [outreachProspects.id]
	}),
}));

export const outreachThreadsRelations = relations(outreachThreads, ({one, many}) => ({
	backlinkSource: one(backlinkSources, {
		fields: [outreachThreads.wonBacklinkSourceId],
		references: [backlinkSources.id]
	}),
	linkOpportunity: one(linkOpportunities, {
		fields: [outreachThreads.opportunityId],
		references: [linkOpportunities.id]
	}),
	outreachMessages: many(outreachMessages),
	primaryContact: one(outreachContacts, {
		fields: [outreachThreads.primaryContactId],
		references: [outreachContacts.id]
	}),
	outreachProspect: one(outreachProspects, {
		fields: [outreachThreads.prospectId],
		references: [outreachProspects.id]
	}),
	site: one(sites, {
		fields: [outreachThreads.siteId],
		references: [sites.id]
	}),
}));

export const outreachMessagesRelations = relations(outreachMessages, ({one, many}) => ({
	inReplyTo: one(outreachMessages, {
		fields: [outreachMessages.inReplyToMessageId],
		references: [outreachMessages.id],
		relationName: "outreachMessages_inReplyToMessageId_outreachMessages_id"
	}),
	outreachMessages: many(outreachMessages, {
		relationName: "outreachMessages_inReplyToMessageId_outreachMessages_id"
	}),
	outreachThread: one(outreachThreads, {
		fields: [outreachMessages.threadId],
		references: [outreachThreads.id]
	}),
}));

export const pageClusterTargetsRelations = relations(pageClusterTargets, ({one}) => ({
	queryCluster: one(queryClusters, {
		fields: [pageClusterTargets.clusterId],
		references: [queryClusters.id]
	}),
	page: one(pages, {
		fields: [pageClusterTargets.pageId],
		references: [pages.id]
	}),
}));

export const queryClustersRelations = relations(queryClusters, ({one, many}) => ({
	pageClusterTargets: many(pageClusterTargets),
	queries: many(queries),
	site: one(sites, {
		fields: [queryClusters.siteId],
		references: [sites.id]
	}),
}));

export const queriesRelations = relations(queries, ({one, many}) => ({
	queryCluster: one(queryClusters, {
		fields: [queries.clusterId],
		references: [queryClusters.id]
	}),
	searchConsoleDailies: many(searchConsoleDaily),
}));

export const reviewsRelations = relations(reviews, ({one}) => ({
	site: one(sites, {
		fields: [reviews.siteId],
		references: [sites.id]
	}),
}));

export const searchConsoleDailyRelations = relations(searchConsoleDaily, ({one}) => ({
	page: one(pages, {
		fields: [searchConsoleDaily.pageId],
		references: [pages.id]
	}),
	query: one(queries, {
		fields: [searchConsoleDaily.queryId],
		references: [queries.id]
	}),
	site: one(sites, {
		fields: [searchConsoleDaily.siteId],
		references: [sites.id]
	}),
}));

export const siteDomainFootprintsRelations = relations(siteDomainFootprints, ({one}) => ({
	site: one(sites, {
		fields: [siteDomainFootprints.siteId],
		references: [sites.id]
	}),
}));

export const siteBacklinkFootprintsRelations = relations(siteBacklinkFootprints, ({one}) => ({
	site: one(sites, {
		fields: [siteBacklinkFootprints.siteId],
		references: [sites.id]
	}),
}));

export const competitorBacklinkFootprintsRelations = relations(competitorBacklinkFootprints, ({one}) => ({
	siteCompetitor: one(siteCompetitors, {
		fields: [competitorBacklinkFootprints.siteCompetitorId],
		references: [siteCompetitors.id]
	}),
}));
