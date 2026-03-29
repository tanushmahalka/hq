# HQ Platform Feature Checklist

CEO-friendly view of what the platform already does based on the current codebase.

## Legend

- `[x]` Live in HQ today
- `[~]` Operational through agent or integration flows, but not yet a fully polished HQ product surface
- `[ ]` Foundation exists in code or roadmap, but it is not yet a finished workflow inside HQ

## 1. Core HQ Workspace

- `[x]` Secure login and invite-only access
- `[x]` Organization-based workspace access
- `[x]` Admin and member roles
- `[x]` Team invitation flow with shareable invite links
- `[x]` Member roster and pending invite management
- `[x]` Real-time HQ home screen showing connected agents
- `[x]` Live agent activity indicators
- `[x]` Real-time chat with agents from inside HQ
- `[x]` Image attachments can be sent into agent chat
- `[x]` Shared approvals inbox for pending human decisions
- `[x]` Logs panel for operational visibility
- `[x]` Events panel for live system activity
- `[x]` Status bar showing approvals, completed tasks, total agents, and active agents
- `[x]` Admin view toggle so admins can see the product as a normal user
- `[x]` Extensible navigation model for adding new HQ modules over time

## 2. Swarm / Agent Operating System

- `[x]` Live agent swarm connection to the HQ workspace
- `[x]` Agent roster with identity, role, and activity state
- `[x]` Agent chat sessions can stay persistent by session
- `[x]` Agent approvals can pause work and wait for a human decision
- `[x]` Approval decisions can resume the exact same agent session
- `[x]` Risky or user-visible actions are designed to go through approval gates
- `[x]` Stuck work and approval-blocked work are surfaced clearly in the task board
- `[x]` Agent files can be browsed from HQ
- `[x]` Agent skills can be inspected from HQ
- `[x]` Missing setup requirements for agent skills are visible
- `[x]` Agent-specific databases can be registered to the platform
- `[~]` Lead-agent routing is supported in the task system and environment config
- `[~]` A lead agent can act as the default receiver for work notifications when no direct assignee is set

## 3. Work Management, Orchestration, and Execution

- `[x]` Central task board with `To do`, `Doing`, `Stuck`, and `Done`
- `[x]` Tasks can be viewed in a standard board or grouped by category
- `[x]` Tasks support owners, assignors, due dates, urgency, and importance
- `[x]` Tasks support comments and discussion
- `[x]` `@mentions` in comments can notify agents
- `[x]` Tasks can be linked to campaigns
- `[x]` Assigned tasks can notify the target agent automatically
- `[x]` Tasks use one simple model across the UI, API, and agent tools
- `[x]` Task detail view includes comments and a live session tab
- `[x]` Task status can be updated directly by operators
- `[x]` Approval-blocked work is surfaced clearly in the task board

## 4. Automations and Scheduled Execution

- `[x]` HQ shows scheduled automation jobs in the task area
- `[x]` Each automation shows schedule, assigned agent, last run, next run, and status
- `[x]` HQ keeps session history for automation runs
- `[x]` Operators can open an automation and review prior run conversations
- `[x]` Automation jobs update in real time when cron events fire

## 5. Mission / Objective / Campaign Planning

- `[x]` Missions can be created and assigned to a specific agent
- `[x]` Each mission can hold multiple objectives
- `[x]` Each objective can hold multiple campaigns
- `[x]` Campaigns can be connected to day-to-day tasks
- `[x]` Mission progress is visible at the objective level
- `[x]` Campaign progress is visible through linked task counts
- `[x]` Missions can be paused, resumed, completed, or archived
- `[x]` Objectives can track metric targets, current value, and due dates
- `[x]` Campaigns can track hypothesis, learnings, start date, and end date
- `[x]` Mission updates are pushed back to the assigned agent
- `[x]` Mission context can be injected into tasks so agents know the bigger goal
- `[x]` HQ missions are exposed to agents through a dedicated plugin layer

## 6. SEO / GEO / Website Intelligence

- `[x]` Multi-site SEO workspace
- `[x]` Site-level SEO overview for tracked websites
- `[x]` Page inventory with title, metadata, page type, status, and audit data
- `[x]` Page issue scoring and audit summary
- `[x]` Page search, filtering, and sorting
- `[x]` Page-to-keyword-cluster mapping
- `[x]` Keyword cluster management view
- `[x]` Competitor tracking by domain
- `[x]` Competitor trend charts over time
- `[x]` Competitor ranked keyword visibility data
- `[x]` Keyword opportunity analysis across owned and competitor keywords
- `[x]` GEO tab inside SEO
- `[x]` GEO prompt coverage by query cluster
- `[x]` GEO visibility reporting
- `[x]` GEO recommendation engine for prompt and page gaps
- `[x]` Backlink tracking for existing backlinks
- `[x]` Competitor backlink tracking
- `[x]` Link opportunity tracking
- `[x]` Opportunity status flow from new to approved / won / lost
- `[x]` Outreach approval action from the backlinks workflow
- `[x]` Website analytics dashboard with date range selection
- `[x]` Channel mix, top pages, device split, and trend views
- `[x]` Search and traffic data foundations for Google/Search Console style reporting
- `[x]` Crawl history and crawl fact storage foundations
- `[x]` Internal link graph foundations

## 7. GEO and Entity-Search Foundations Already Wired In

- `[x]` GEO prompt, run, result, citation, and recommendation data model exists
- `[x]` GEO recommendations can be generated from prompt and page coverage gaps
- `[~]` GEO is already positioned as an operating layer for content, PR, entity cleanup, and local SEO work
- `[~]` AI-search benchmarking foundations are present through the SEO CLI and GEO roadmap

## 8. Content, Marketing, and Publishing

- `[x]` Marketing section in HQ for AI-managed content assets
- `[x]` Ebook library in HQ
- `[x]` Live HTML preview for marketing assets
- `[x]` Auto-refreshing preview when a new agent revision is published
- `[x]` Revision history for marketing assets
- `[x]` PDF download/export for ebook assets
- `[x]` Versioned storage of marketing asset revisions
- `[x]` Agent, user, and CLI edits are tracked as update sources
- `[x]` HQ can create and update marketing assets through authenticated APIs
- `[~]` The marketing asset model already supports `ebook`, `email`, `landing page`, and `social` assets
- `[~]` The current HQ UI is ebook-first, while the broader asset types are already supported in the backend

## 9. Website and CMS Control

- `[~]` Framer project inspection is available through the integrated Framer agent CLI
- `[~]` Framer page listing and page-node inspection are available
- `[~]` Framer text content can be read and updated safely
- `[~]` Framer CMS collections and items can be listed and updated
- `[~]` Framer code files can be listed, read, and updated
- `[~]` Framer publish information can be inspected

## 10. Email and Audience Operations

- `[~]` AWeber authentication and account setup are available for agents
- `[~]` AWeber list discovery and account discovery are available
- `[~]` Subscribers can be added, updated, found, and removed
- `[~]` Broadcast emails can be created
- `[~]` Broadcasts can be scheduled for send
- `[~]` Campaign and broadcast analytics can be pulled
- `[~]` Email workflows are operational through the agent integration layer, even though there is not yet a dedicated HQ email dashboard

## 11. Files, Knowledge, and Workspace Access

- `[x]` HQ file browser for the configured workspace
- `[x]` Folder navigation with breadcrumbs
- `[x]` Preview for markdown, text, and images
- `[x]` File and folder download
- `[x]` Mobile-friendly file browser behavior

## 12. Admin, Reporting, and Data Operations

- `[x]` Admin-only usage dashboard
- `[x]` Session-level usage and cost analysis
- `[x]` Daily trend charts for usage
- `[x]` Session log review for operations/debugging
- `[x]` Filtering and export for usage data
- `[x]` Admin-only agent database viewer
- `[x]` Table browser for agent databases
- `[~]` Agent databases can also be provisioned and queried through backend operations

## 13. Foundations for Near-Term Expansion

- `[~]` Link building / digital PR foundations already exist in the data model:
  outreach prospects, outreach contacts, outreach threads, outreach messages, brand mentions, and link opportunities
- `[~]` Business profile and review tracking foundations already exist in the data model
- `[~]` Asset launch / refresh tracking already exists in the SEO schema
- `[~]` Custom page infrastructure already exists, so new business modules can be added without reworking the whole app

## 14. Not Yet Productized as Full HQ Workflows

- `[ ]` Dedicated China Research dashboard/workflow
- `[ ]` Dedicated China Trends scanner/publisher workflow inside HQ
- `[ ]` Dedicated PR dashboard for media lists, outreach management, and follow-ups
- `[ ]` Full China Pulses editorial workflow as a named HQ module
- `[ ]` Dedicated blog-post generation and publishing workflow inside HQ
- `[ ]` AI brand-image generation from product photos
- `[ ]` Download dashboard for AI-generated brand images

## Bottom Line

- `[x]` HQ is already much more than a task board. It is a live operating system for agents, approvals, tasks, missions, SEO/GEO intelligence, marketing asset management, automations, team access, and admin visibility.
- `[x]` The strongest fully surfaced product areas today are:
  core HQ operations, task orchestration, mission planning, SEO/GEO intelligence, ebook/content management, automations, and admin visibility.
- `[~]` The strongest integration-driven capabilities already available are:
  Framer control, AWeber email operations, deeper SEO/GEO workflows, and agent-managed asset updates.
- `[ ]` The biggest unfinished product surfaces relative to the March 20 checklist are:
  China Research, PR, and AI brand image generation.
