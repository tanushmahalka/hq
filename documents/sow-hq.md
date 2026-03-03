# Statement of Work (SOW)

**Business HQ AI System + Executive Agent (Josh)**

**Prepared for:** Kung Fu Data Pte. Ltd. ("Client")  
**Prepared by:** Auvihaus Global Private Limited ("Auvihaus")  
**Date:** Feb 25, 2026

**Note:** This SOW defines scope, deliverables, timeline, pricing, and operational cadence. Commercial/legal terms (liability, jurisdiction, etc.), IP ownership, licensing, assignment, and continuity/step-in rights are governed exclusively by the Services Agreement. This SOW defines operational scope, deliverables, and service execution only.

## 1. Parties & Signatory Identification

### Client
- Kung Fu Data Pte. Ltd.
- UEN: [Insert]
- Registered Office: [Insert Address], Singapore
- Primary Stakeholder: Josh Gardner (CEO/Founder)
- Project Stakeholders: Kilee, Skyler (Marketing & Content Leads)

### Service Provider
- Auvihaus Global Private Limited
- CIN: U73100WR2026PTC292308
- Registered Office: HILAND GREEN PHASE 1, BL-7, 12TH FLR, FL-A5, Batanagar, Bishnupur - I, South 24 Parganas- 700140, Kolkata, India
- Authorized Signatory: Reeshav Bamrolia, Director

## 2. Engagement Objective

Deploy and operate a Business HQ AI System and a Josh Executive Agent that:

- Automates and scales Kung Fu Data's marketing, growth, and BD workflows
- Improves SEO/GEO visibility and distribution velocity
- Establishes ABM and brand-sourcing capabilities
- Enables auditable, safe execution with validation gates
- Allows added team members to directly run, supervise, and calibrate agent outputs
- Runs on Client-controlled infrastructure with full access/continuity

## 3. In-Scope Components

This SOW covers:

- A) Business HQ AI System (Agent Swarm + Workflows)
- B) Josh Executive Agent (Chief of Staff + Growth Interface)

## 4. Timeline & Delivery Plan

### Phase 0 - Kickoff & Access Setup (Week 1)

#### Deliverables
- Kickoff call (60 min)
- Access checklist finalization and provisioning
- Create/confirm infrastructure accounts under Client ownership (AWS + required services)
- Configure baseline security controls and approval gates

#### Acceptance Criteria
- Required access granted (or confirmed not available)
- Environments created + admin access confirmed for Client

### Phase 1 - Business HQ v1 Deployment (Weeks 2-4)

This is the "ship a working HQ" phase.

#### Deliverables
- HQ Core App deployed (dashboard + agent workspace + audit view)
- Swarm v1 launched with initial agent roles:
  - Swarm Lead / Orchestrator
  - SEO/GEO Agent
  - Content Distribution Agent
  - China Research & Trends Agent
  - ABM Agent
  - Brand Finder Agent
  - PR/Outreach Agent
- Kilee & Skyler accounts set up with admin permissions
- Core workflows live (detailed in Section 6)

### Phase 2 - Calibration & Production Hardening (Weeks 5-8)

This is where reliability is built.

#### Deliverables
- Prompt/logic tuning with feedback loops
- Publishing/distribution pipelines integrated with approval gates
- Reporting dashboard v1 (weekly output metrics + quality metrics)

### Phase 3 - Expansion Workflows (Month 3)

This is where you add the "business operators" workflows.

#### Deliverables (Target Outcomes)
- Purchase Order forecast drafts (template-based)
- Initial business plan drafts for prospective partners
- Finance consolidation workflow discovery + feasibility
- Cashflow analysis prototype (if data access is provided in usable form)

## 5. Operating Cadence & Support

### Calls
- Weeks 1-8: Weekly 60-minute calls
- Month 3 onward: Monthly 60-minute call

### Communication
- Dedicated Business HQ WhatsApp group (Kung Fu Data team + Auvihaus team)

### Response Targets (operational expectation, not a legal SLA)
- Acknowledge within 1 business day
- Fix/iterate in next sprint cycle based on severity

## 6. Detailed Deliverables & Workflows

The Business HQ operates as a workflow automation engine. Kung Fu Data ("KFD") defines desired business workflows. Auvihaus designs, engineers, calibrates, and automates those workflows using the AI HQ. Each workflow below represents an initial implementation track for initial workflows and are expected to evolve over time with more workflows.

**Note:** The system is intelligent enough to create its own new workflows. However, Auvihaus will help to ensure the automatically-created workflows are quality-checked & secured.

### 6.1 Model Strategy & Integrations (Multi-Model)

#### Objective
Ensure the Business HQ leverages the most appropriate AI models per task rather than being restricted to a single provider.

#### Supported Provider Routing (as needed per task)
- Anthropic Claude (including Opus-class models)
- Google Gemini (deep research and multi-source synthesis)
- OpenAI models (tool reliability and structured output tasks)
- Perplexity (research retrieval tasks where appropriate)
- Minimax (task-dependent routing where appropriate)
- Kimi (long-context or research-heavy tasks where appropriate)
- Other providers via a model router where appropriate

The system is not restricted to a single protocol or vendor.

#### Routing Principle
Model selection is dynamically determined based on:

- Quality benchmark for the task
- Reliability and uptime stability
- Cost efficiency
- Tooling and integration capability

Auvihaus continuously evaluates model performance and adjusts routing as needed.

#### Current Primary Recommendation
OpenAI Codex is currently the primary baseline for production orchestration due to tool-integration reliability, session stability, and structured output consistency.

Routing remains provider-agnostic, and workflows may route to Claude, Gemini, Perplexity, Minimax, Kimi, or other providers when task-level benchmarks are better.

### 6.2 SEO & GEO Workflow Automation

#### Objective
Automate SEO/GEO intelligence, validation, and structured execution workflows for KFD's digital presence.

#### Workflow Model
KFD defines:

- Target keywords
- Target positioning
- Content priorities
- Risk tolerance for automated changes

Auvihaus builds:

- Technical SEO audit workflow
- Structured change recommendation engine
- GEO visibility monitoring prompts
- Validation gates before deployment

#### System Outputs May Include
- Structured SEO audit summaries
- Prioritized change recommendations
- Schema/metadata/internal link suggestions
- GEO monitoring prompts and citation checks
- SEO/GEO reporting dashboards

#### Execution Model
No website code changes are automatically deployed without approval, unless explicit auto-approval rules are defined.

### 6.3 China Trends -> Content Workflow

#### Objective
Automate research-to-content workflow aligned with KFD editorial voice.

#### Workflow Model
KFD provides:

- Brand positioning guidance
- Content standards
- Approval thresholds

Auvihaus builds:

- Research aggregation agent
- Trend summarization engine
- Voice-constrained drafting workflow
- Review routing system

#### Acceptance Criteria
- Weekly research brief delivered
- Drafts adhere to defined voice constraints
- Review queue operational

### 6.4 ABM + Prospecting Workflow

#### Objective
Automate prospect discovery and validation at scale.

#### Workflow Model
KFD defines:

- ICP criteria
- Brand maturity thresholds
- Geographic relevance
- China-market compatibility filters

Auvihaus engineers:

- Machine-readable ICP logic
- Prospect list generation engine
- Multi-pass validation workflow
- Confidence scoring system
- Exception flag routing

#### Validation Layers
- Source verification
- Duplicate detection
- Criteria rule enforcement
- Confidence scoring
- Exception flagging

#### Outputs May Include
- Prospect lists (100-1000+)
- Structured scoring fields
- Traceability references
- CSV / Sheet exports

#### Execution Safeguards
Low-confidence entries routed to review before action.

### 6.5 Brand Finder Evolution Workflow

#### Objective
Automate structured brand discovery aligned with Josh's proprietary criteria.

#### Workflow Model
KFD provides:

- Brand rule definitions
- Heat criteria
- Category logic
- China presence expectations

Auvihaus builds:

- Rule translation engine
- Discovery sweep logic
- Multi-factor scoring engine
- Second-pass audit agent
- Shortlist/longlist generator

### 6.6 PR & Outreach Workflow

#### Objective
Automate outreach preparation with approval control.

#### Workflow Model
KFD defines:

- Target publications
- Outreach tone guidelines
- Risk tolerance

Auvihaus builds:

- Journalist tracking system
- Pitch drafting engine
- Outreach queue
- Approval gate
- Status reporting

No outreach is sent without explicit approval unless whitelist rules are later defined.

### AI Capability Disclaimer (Applies to All Section 6 Workflows)

The Business HQ relies on probabilistic AI models and browser-based automation tools.

Outputs depend on:

- Model capabilities
- Third-party provider stability
- Browser-control reliability
- Data quality

Auvihaus commits to continuous calibration and validation layers but cannot guarantee 100% output accuracy.

Final business decisions remain under Client control.

### 6.9 Agent Swarm Capacity, Limits, and Evolution

#### Capacity Guidance
The Business HQ is initially sized for up to 10 active production agents to maximize reliability, observability, and operating quality.

#### Important Clarification
Up to 10 is a recommended operating envelope, not a hardcoded product limit.

The system architecture can support dynamic expansion, including agent-generated agent creation patterns where appropriate.

#### Scale Evolution
If operating needs expand materially beyond 10 active production agents, infrastructure sizing and commercial scope may require revision to maintain reliability and support quality.

Any approved expansion will be documented as a written scope/capacity update.

## 7. Training & Enablement Deliverables

### Included Training
- 2 onboarding sessions for the Kung Fu Data Team (live)
- 1 operations session: "how to run HQ weekly"
- Documentation package:
  - What to feed each agent for optimal performance
  - Validation rules + how to tune
  - "Do/Don't" playbook for safe execution

### Our Acceptance Criteria
The Kung Fu Data can run the weekly cycle without Auvihaus driving.

## 8. Auditability, Accuracy & Safety Controls

System design will have the capability to include the following when required:

- Evidence fields / citations where relevant
- Confidence scoring
- Exception flagging
- Sampling policies
- Human approval gates (publish, outreach, sensitive changes)
- Validation agent cross-checking outputs

### Key Point
You do not manually validate every row of a 1,000-brand list.

You validate via automation + sampling + flagged exceptions.

## 9. Access & Team Roles

- Josh: Owner/Admin
- Kilee & Skyler: Admin access to Business HQ
- Unlimited additional team logins (no added cost)

## 10. Included Infrastructure & Costs

The monthly subscription includes all required infra and model access to run the scoped system.

### Included components (current stack)
- AWS infrastructure (HQ app + OpenClaw instances)
- Super-Memory (agent memory layer)
- Neon (database)
- Tigris (S3-compatible storage + backups)
- OpenAI Codex subscription accounts (token efficiency)
- OpenRouter routing (multi-model marketplace)

### OpenClaw Continuity Note
OpenClaw is currently used as part of the stack under an open-source MIT-licensed codebase.

Auvihaus maintains an internal fork for operational continuity.

Any upstream ownership, licensing, or commercial changes to the parent project will not remove Client's ability to run, maintain, and extend the deployed fork within Client-controlled infrastructure.

### Note on evolution
This stack may change over time as the ecosystem evolves, without reducing functionality.

If any change in this infrastructure is to be made, Auvihaus will give a notice 30 days in advance.

## 11. Pricing & Payment Schedule (Business HQ + Josh Agent Only)

### One-time Setup Fee
- Business HQ Setup: $5,000
- Josh Executive Agent Setup: $800
- **Total One-time: $5,800**

### Monthly Subscription
- Business HQ: $1,500 / month
- Josh Executive Agent: $250 / month
- **Total Monthly: $1,750 / month**

### Invoicing
- Setup invoiced at kickoff
- Monthly invoiced on the 1st of each month

## 12. Deliverable Acceptance Framework

Deliverable acceptance under this SOW is structured by category:

- Phase-Based Setup Deliverables
- Ongoing Monthly Operational Deliverables
- Expansion / New Workflow Deliverables

### 12.1 Phase-Based Setup Deliverables (One-Time Milestones)

Phase-based deliverables include, but are not limited to:

- Initial HQ deployment
- Initial Swarm configuration
- Model routing layer setup
- Workflow v1 implementations
- User access configuration
- Initial training sessions

#### Definition of Delivery (Setup Phase)
A setup deliverable is considered Delivered when:

- The defined workflow or system component is deployed in the agreed environment
- Client has functional access
- The workflow executes end-to-end without system error
- Outputs are generated in the agreed format
- Required onboarding/training session (if applicable) has occurred

### 12.2 Ongoing Monthly Operational Deliverables

Monthly deliverables include:

- Execution of defined workflows (SEO, Trends, ABM, etc.)
- Ongoing calibration and tuning
- Model routing adjustments
- Workflow refinement
- Support and iteration sessions

Monthly services are considered performed if:

- The defined workflows run as scheduled
- Outputs are generated and routed appropriately
- The system remains accessible
- Scheduled review sessions occur

Because AI systems are probabilistic and iterative, monthly services are not subject to binary acceptance or rejection. Instead:

- If a material functional failure occurs (e.g., workflow stops executing), Client must notify Auvihaus in writing, and Auvihaus will remediate within a commercially reasonable time.
- Monthly services are not rejected based on output preference or subjective quality concerns where functional criteria are met.

### 12.3 Deemed Acceptance

A deliverable shall be deemed accepted if:

- No written rejection is submitted within the applicable testing window
- Client places the workflow into production use

## 13. Offboarding & Handover (Continuity Deliverables)

Because the AI HQ is deployed in Client-owned environments and Client-controlled accounts, Client retains ongoing possession of its infrastructure, data, and system state at all times. Accordingly, handover is structured as a continuity and knowledge-transfer package, not a "data return." If the engagement ends in accordance with the termination notice requirements set out in the Services Agreement, Auvihaus will provide a structured handover package ("Handover Package") to enable Client to continue operating, maintaining, and extending the deployed system independently.

### 13.1 Handover Timeline & Process

- Handover activities will be completed during the contractual notice period (typically 30 days).
- Auvihaus will deliver the Handover Package no later than the final business day of the notice period, provided required dependencies are met (e.g., continued access to the Client environment for documentation and walkthrough).
- Client will appoint a technical point of contact for the handover.

### 13.2 Handover Package Contents (Documentation + Continuity)

Auvihaus will provide the following documentation and continuity deliverables.

#### A) System Overview Document
- What was built (components and capabilities)
- What each agent does (roles and responsibilities)
- What workflows exist today (SEO/GEO, ABM, Trends, PR, etc.)
- What approval gates exist and where they are configured
- Known limitations and recommended operating practices

#### B) Architecture & Environment Map
- High-level architecture diagram
- Deployment topology (services, runtime, environment layout)
- Data flow diagram (where memory, logs, outputs live)
- Integration map (what tools are connected and what permissions were granted)

#### C) Configuration Inventory ("Where Everything Is")
A structured inventory of:

- Environment variables and runtime configuration locations
- Secrets references (not plaintext keys)
- Where to rotate credentials inside Client secret storage
- Provider/service list used in the Client account (AWS, DB, storage, router, etc.)

#### D) Workflow Runbooks (Operate Without Auvihaus)
Step-by-step guides for:

- Running weekly trend -> content workflow
- Running ABM/prospecting workflow and reviewing exceptions
- Running Brand Finder workflow and tuning rules
- Running PR/outreach workflow with approvals
- Handling common failure modes (timeouts, provider errors, output formatting issues)

#### E) Development Notes ("How to Continue Building It")
- Codebase structure / repo layout (if applicable)
- How to add a new agent
- How to add a new workflow
- How to add a new skill/tool integration
- How to update model routing rules
- How to test changes safely (staging/review guidance)
- Suggested next development roadmap options

#### F) Client-Specific Prompt & Workflow Logic Snapshot (Optional Convenience)
Because prompts/configs may be stored across repositories/config files, Auvihaus will provide a snapshot copy of the latest client-specific prompt sets and business rules used in production at the time of offboarding, delivered as:

- Markdown files (human-readable)
- JSON/YAML where applicable (machine-readable)
- A README mapping each file to its function in the system

**Important:** This snapshot is a convenience copy. The authoritative source remains within Client's environment.

### 13.3 Verification Checklist (Client Control Confirmation)

Auvihaus will provide a handover checklist confirming that:

- All infrastructure is within Client-owned accounts
- All operational access is held by Client admins
- Auvihaus access can be removed cleanly
- Credential rotation plan is documented
- System can run without Auvihaus accounts

### 13.4 Handover Session(s)

#### Included
One (1) live handover session (60 minutes) with Client technical stakeholders covering:

- Architecture walkthrough
- Operational runbooks
- Where configuration lives
- How to continue development
- Q&A

#### Optional (if needed and agreed)
Additional sessions can be scheduled as part of the notice period, subject to mutual availability.

### 13.5 Exclusions (Clarity)

Handover does not include:

- Ongoing support after end date
- New feature development after end date
- Migration to a new infrastructure stack unless separately scoped
- Third-party subscription transfers unless those accounts are owned by Client

### 13.6 Dependencies

To complete handover, Client agrees to:

- Maintain Auvihaus access to the Client environment during the notice period for documentation and walkthrough purposes
- Assign a technical point of contact
- Confirm secure delivery method for documentation package (Drive link / secure workspace)

### 13.7 Business Continuity Trigger (Insolvency/Cessation)

If Auvihaus ceases operations, enters insolvency proceedings, or is unable to provide services for 30 consecutive days for reasons not caused by Client, continuity rights activate automatically for Client.

On trigger:

- All Client-specific workflow configurations, prompt packs, process logic, and documentation delivered under this SOW transfer to Client for uninterrupted business use.
- Client may appoint a replacement technical provider to maintain and extend the deployed system using the delivered handover materials and Client-controlled environments.

## 14. Assumptions & Dependencies

This SOW is based on the following assumptions and dependencies. Timelines and deliverables rely on these being satisfied.

### 14.1 Access to Required Systems & Tools

Client agrees to provide timely access to:

- Existing internal systems
- Marketing platforms
- Financial systems
- CRM tools
- Content repositories
- Analytics platforms
- Hosting environments
- API keys (where appropriate)

If Client uses third-party tools, platforms, or subscription services that are:

- Not listed under the "Included Infrastructure & Costs" section of this SOW, and
- Required for Business HQ workflows (e.g., scraping tools, proprietary data sources, SEO software, analytics software, financial software),

Client will provide appropriate access credentials and maintain active subscriptions to such tools. Auvihaus is not responsible for licensing, subscription fees, or availability of third-party tools not explicitly included in this SOW.

### 14.2 Infrastructure & Architecture Flexibility

Client acknowledges that effective AI agent deployment may require modifications to existing technical infrastructure.

This may include, without limitation:

- Adjustments to hosting architecture
- API enablement
- Structured data exposure
- Backend access configuration
- Workflow automation hooks
- CMS restructuring

If Client's current infrastructure (e.g., website platform such as Framer or other no-code tools) limits AI integration capabilities, Client agrees to reasonably consider infrastructure adjustments where technically necessary to achieve the objectives of this SOW.

Such adjustments may include:

- Migration to a more agent-compatible environment
- Implementation of custom code layers
- Backend data restructuring
- Deployment of API middleware

Auvihaus will advise on technical requirements and provide rationale for recommended changes. Final implementation decisions remain collaborative but may impact performance if declined.

### 14.3 Data Quality & Structure

AI workflow performance assumes that:

- Data provided by Client is accurate
- Data is structured or exportable in machine-readable formats where required
- Access permissions are valid and stable

Where data is incomplete, unstructured, or inaccessible, workflow reliability may be impacted.

### 14.4 Operational Collaboration

Successful deployment assumes:

- Timely feedback during calibration phases
- Clear definition of brand criterias 7 requirements
- Participation in weekly review cycles during initial phases

## 15. Entire Agreement

This SOW is the complete understanding regarding AI Operating System deployment.

## Signature

Kung Fu Data

## Signature

AUVIHAUS GLOBAL PRIVATE LIMITED
