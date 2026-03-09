# Bootstrap `sites`

Use this playbook for bootstrap step 1 and step 2.

## Goal

Collect the required business interview data and save exactly one `sites` row.

## Required interview questions

Ask these exact questions before saving anything:

- What is the business name and primary domain?
- What type of business is this: local, SaaS, ecommerce, publisher, or other?
- What niche or industry are you in?
- Which countries, regions, or cities matter most?
- What are the primary offers or revenue-driving services/products?
- Who is the target audience?
- What counts as a primary conversion for SEO: purchase, lead form, booked call, demo, signup, store visit, or something else?
- Are there secondary conversions we should track?
- What CMS or stack is the site built on?
- What should we use as the default locale and timezone?
- Do we need local SEO entities like business profiles and reviews in scope?
- Is Google Search Console already connected?
- Is Google Analytics already connected?
- Is the SEO database with the schema tables already available?

## Map interview answers to `sites`

Save one row to `sites` with:

- `name`: business name
- `domain`: primary canonical domain
- `business_type`: `local | saas | ecommerce | publisher | other`
- `cms`: platform value such as `wordpress | shopify | webflow | custom`
- `default_locale`: locale code such as `en-US`
- `timezone`: canonical business timezone
- `is_active`: `true` unless the site is intentionally inactive

## Required fields

Do not save a `sites` row until these are known:

- `name`
- `domain`
- `business_type`

## Stop condition

Stop and ask the user for clarification if:

- the primary domain is unclear
- more than one site should be managed
- the business type does not map cleanly to the schema
- the database is not available for the write
