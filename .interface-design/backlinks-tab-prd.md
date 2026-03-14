# Backlinks Tab PRD

Owner: Product
Audience: UI/UX, frontend, product engineering
Status: Draft for design exploration
Related files:
- [system.md](/Users/tanushmahalka/Desktop/Programs/psx/hq/.interface-design/system.md)
- [seo.tsx](/Users/tanushmahalka/Desktop/Programs/psx/hq/src/pages/seo.tsx)
- [seo.ts](/Users/tanushmahalka/Desktop/Programs/psx/hq/drizzle/schema/seo.ts)

## 1. Summary

The Backlinks tab is the intelligence workspace for off-page SEO inside HQ.

It should answer three operator questions:

1. What backlinks do we already have?
2. What backlinks do competitors have that we do not?
3. What backlink opportunities should we pursue next?

This tab is not the place for writing or sending emails. It is the research, filtering, review, and prioritization surface that feeds the Outreach tab.

## 2. Product Goal

Help a non-technical operator quickly understand the current link landscape and turn that understanding into a prioritized queue of opportunities for outreach.

The tab should feel:
- calm
- high-signal
- operator-friendly
- intelligent, not overwhelming

The user should leave with a clear answer to:
- where we are strong
- where competitors are ahead
- which opportunities are worth acting on now

## 3. Primary Users

### Primary

- Founder / operator overseeing SEO
- Marketing lead managing off-page growth
- SEO strategist supervising agents

### Secondary

- Outreach operator reviewing queued opportunities
- Analyst inspecting backlink quality and coverage

## 4. Jobs To Be Done

When I open Backlinks, I want to:

- scan backlink health without reading raw SEO exports
- compare our backlink footprint against competitors
- review opportunities with enough context to trust them
- approve the best opportunities for outreach
- ignore junk prospects before they waste team attention

## 5. Scope

### In scope

- Existing backlinks view
- Competitor backlinks view
- Opportunities view
- Site switching
- filtering, sorting, search
- row detail inspection
- approve / reject opportunity actions
- clear handoff to Outreach

### Out of scope

- composing outreach messages
- sending email
- thread management
- campaign planning
- deep analytics attribution

Those belong in the Outreach tab or later analytics work.

## 6. Information Architecture

Backlinks lives inside SEO as a top-level tab beside the current SEO views.

Backlinks contains 3 subviews:

1. Existing
2. Competitors
3. Opportunities

These should feel like three modes of one workspace, not three separate products.

## 7. Core UX Principle

The main unit in this product is not just a domain. It is a specific placement context.

The UI should bias toward:
- source page
- target page
- why it matters
- current status

The design should avoid presenting giant undifferentiated domain lists.

## 8. Data Model The UI Should Assume

### Existing backlinks

Backed by `backlink_sources`.

Key fields:
- source domain
- source URL
- source title
- target URL
- target page
- anchor text
- rel attr
- link type
- authority score
- relevance score
- first seen
- last seen
- verified at
- status

### Competitor backlinks

Backed by `competitor_backlink_sources`.

Key fields:
- competitor
- source domain
- source URL
- source title
- target URL
- anchor text
- rel attr
- link type
- authority score
- relevance score
- first seen
- last seen
- status

### Opportunities

Backed by `link_opportunities`.

Key fields:
- source domain
- source URL
- source title
- target page
- opportunity type
- discovered from
- why this fits
- suggested anchor text
- relevance score
- authority score
- confidence score
- risk score
- status
- first seen
- last reviewed
- linked prospect if available
- linked competitor if applicable
- linked brand mention if applicable

## 9. Primary Layout

Use the existing HQ page structure from the design system.

Recommended layout:

- Page header
- Subtab bar
- Summary strip
- Main content split into:
  - left: dense table/list
  - right: contextual detail panel

This should feel similar to a calm research console.

### Header

Header elements:
- title: `Backlinks`
- site selector
- optional global search

### Subtab bar

Three subtab buttons:
- Existing
- Competitors
- Opportunities

Each should show a compact count.

### Summary strip

For the selected site and selected subview, show 3-5 key summary numbers.

Examples:

For Existing:
- referring domains
- live backlinks
- money pages linked
- avg authority

For Competitors:
- competitor domains tracked
- competitor backlinks tracked
- link gap count

For Opportunities:
- new opportunities
- high-confidence opportunities
- approved for outreach
- rejected

## 10. Shared Interaction Model

All three subviews should support:
- search
- sort
- filtering
- row selection
- persistent right-side detail panel

Row selection should never navigate away from the page.

The detail panel is critical. Operators should not need modals for routine inspection.

## 11. Subview Requirements

### A. Existing Backlinks

Purpose:
- inspect what we already earned
- understand backlink quality
- see which target pages already have support

Default table columns:
- Source
- Target page
- Anchor
- Rel
- Authority
- Relevance
- Last seen
- Status

Recommended row display:
- primary line: source title or source URL
- secondary line: source domain

Detail panel should include:
- full source URL
- full target URL
- source title
- anchor text
- rel attr
- link type
- first seen / last seen / verified at
- page metadata for the target page
- optional action: `Open source`

Filters:
- target page
- source domain
- status
- rel attr
- link type
- authority range
- relevance range

Empty-state language:
- “No backlinks tracked yet. Once backlinks are imported or verified, they’ll appear here.”

### B. Competitor Backlinks

Purpose:
- see where competitors are getting mentioned
- identify link gap patterns
- spot domains/pages where we may belong

Default table columns:
- Competitor
- Source
- Competitor target URL
- Anchor
- Authority
- Relevance
- Last seen

Detail panel should include:
- selected competitor
- source URL
- source title
- competitor target URL
- why this might matter to us
- action: `Create opportunity`

Filters:
- competitor
- source domain
- target URL contains
- authority range
- relevance range

Important UX note:
This view should not force the user to mentally compare two giant tables. It should make gap discovery easy.

Recommended enhancement:
- add a toggle for `Only likely gaps`

Definition of likely gap in UI terms:
- competitor has link
- we do not have link from same domain or same source page

### C. Opportunities

Purpose:
- review the best possible backlink opportunities
- validate that they are real
- approve only the strongest ones for outreach

This is the most important subview in the tab.

Default table columns:
- Source
- Target page
- Type
- Why fit
- Confidence
- Risk
- Status
- First seen

Detail panel should include:
- source page
- source domain
- target page
- opportunity type
- discovered from
- why this fits
- suggested anchor
- prospect details if available
- linked competitor if this came from competitor gap
- linked brand mention if this came from mention discovery

Primary actions:
- `Approve for outreach`
- `Reject`
- `Mark reviewed`

Secondary actions:
- `Open source`
- `Open target page`

Filters:
- status
- opportunity type
- target page
- prospect linked / unlinked
- competitor linked / unlinked
- confidence range
- risk range
- discovered from

Default sort:
- highest confidence first
- lowest risk second
- newest third

## 12. Detail Panel Behavior

The right panel should adapt by subview but keep a consistent structure:

1. Item title
2. Core metadata
3. Why it matters
4. Related records
5. Actions

For Opportunities, “Why it matters” should be visually prominent. This is the main trust-building element in the product.

## 13. Status Model

### Existing backlinks status

Suggested statuses:
- live
- lost
- unverified

### Competitor backlinks status

Suggested statuses:
- live
- lost
- unknown

### Opportunity status

Suggested statuses:
- new
- reviewed
- approved
- rejected
- thread_open
- won
- lost

The UI should use compact status pills and small dots, not loud color blocks.

## 14. Key User Flows

### Flow 1: Inspect current backlink footprint

1. User opens Backlinks
2. Lands on Existing
3. Scans summary strip
4. Filters by target page
5. Opens a backlink detail row
6. Understands if the page already has support

### Flow 2: Discover competitor gap

1. User switches to Competitors
2. Filters by one competitor
3. Sorts by highest authority
4. Opens a source page
5. Determines whether our page should also belong there
6. Creates or reviews resulting opportunity

### Flow 3: Approve opportunities for outreach

1. User switches to Opportunities
2. Filters to `new` and `high confidence`
3. Reviews one row at a time in the detail panel
4. Approves the best ones
5. Approved items become available in Outreach

## 15. Handoff To Outreach

The Backlinks tab should not show email drafts.

But it must clearly support the moment where an operator says:
- “Yes, this is real”
- “This should go to outreach”

Required action:
- `Approve for outreach`

Expected result:
- opportunity status updates to `approved`
- opportunity becomes available in the Outreach workspace

The UI should make this handoff feel intentional and lightweight.

## 16. Search And Filtering Guidance

This page will get noisy fast if filters are weak.

Design for fast scanning:
- filters should be inline and visible
- avoid burying essential filters in a modal
- power filters should collapse nicely on smaller widths

Most-used filters should always be one click away:
- subview
- target page
- status
- competitor
- confidence

## 17. Sorting Guidance

Use sensible defaults per subview.

Existing:
- last seen desc

Competitors:
- authority desc

Opportunities:
- confidence desc, risk asc

## 18. Empty States

Empty states should be calm and directional, not dead ends.

Examples:

Existing:
- “No backlinks tracked yet.”

Competitors:
- “No competitor backlinks imported yet.”

Opportunities:
- “No opportunities available yet. They’ll appear here after discovery runs or competitor-gap analysis.”

If useful, include one small next-step hint, not a full tutorial.

## 19. Loading States

Avoid skeleton overload.

Recommended:
- skeleton for summary strip
- skeleton table rows
- muted placeholder in detail panel

The page should still feel stable while data loads.

## 20. Responsive Behavior

Desktop is the primary target.

Desktop:
- table + right detail panel

Tablet:
- stacked or collapsible detail panel

Mobile:
- list first, detail in sheet

The MVP should optimize for desktop first.

## 21. Visual Direction

Use the HQ design system.

Specific guidance:
- warm editorial title treatment
- calm, dense data table
- minimal charting unless truly helpful
- rely on typography, spacing, and soft status indicators
- use the shimmer only for active/agent-driven states, not everywhere

Do not make this feel like a generic SEO dashboard.
It should feel like an operator console for AI-assisted research.

## 22. Success Criteria

The Backlinks tab is successful if a user can:

- understand backlink state in under 30 seconds
- identify meaningful competitor gaps without exporting data
- approve a small set of strong opportunities with confidence
- avoid wasting time on low-quality prospects

## 23. MVP Design Deliverables

UI/UX team should produce:

1. Desktop layout for Backlinks tab
2. Subview states for Existing, Competitors, Opportunities
3. Table row design
4. Detail panel design
5. Filtering/sorting interaction design
6. Opportunity approval interaction
7. Empty/loading states

## 24. Open Questions For Design Exploration

- Should Competitors and Opportunities share the same table skeleton to reduce cognitive switching?
- Should the detail panel stay pinned, or be optionally collapsible?
- Should “Create opportunity” exist in the Competitors view, or should that happen automatically in backend discovery?
- How should confidence and risk be shown: numeric, bar, badge, or subtle scale?
- Should there be a lightweight compare mode for our backlinks vs competitor backlinks on the same target topic?

## 25. Recommendation

For MVP, optimize hardest for `Opportunities`.

Why:
- it is where product intelligence becomes action
- it creates the handoff into Outreach
- it is the least obvious SEO workflow, so good design here will differentiate HQ most

If there is a tradeoff, keep Existing and Competitors simpler and put the most design energy into making Opportunities feel trustworthy, fast, and calm.
