import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const abmOffers = pgTable("abm_offers", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  organizationId: text("organization_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  offerType: text("offer_type").notNull().default("product"),
  status: text("status").notNull().default("draft"),
  valueProps: jsonb("value_props"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const abmAudiences = pgTable(
  "abm_audiences",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    offerId: integer("offer_id")
      .notNull()
      .references(() => abmOffers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    buyingCommittee: jsonb("buying_committee"),
    metadata: jsonb("metadata"),
    isPrimary: boolean("is_primary").notNull().default(false),
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
    offerNameUnique: unique("abm_audiences_offer_name_unique").on(
      table.offerId,
      table.name,
    ),
  }),
);

export const abmAudienceFilters = pgTable(
  "abm_audience_filters",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    audienceId: integer("audience_id")
      .notNull()
      .references(() => abmAudiences.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    field: text("field"),
    operator: text("operator"),
    value: jsonb("value"),
    rule: jsonb("rule"),
    isRequired: boolean("is_required").notNull().default(true),
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
    audienceSortUnique: unique("abm_audience_filters_audience_sort_unique").on(
      table.audienceId,
      table.sortOrder,
    ),
  }),
);

export const abmAudienceSignals = pgTable(
  "abm_audience_signals",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    audienceId: integer("audience_id")
      .notNull()
      .references(() => abmAudiences.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    signalType: text("signal_type").notNull(),
    sourceType: text("source_type"),
    rule: jsonb("rule"),
    weight: numeric("weight", { precision: 6, scale: 2 }),
    freshnessDays: integer("freshness_days"),
    isRequired: boolean("is_required").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
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
    audienceSignalSortUnique: unique(
      "abm_audience_signals_audience_sort_unique",
    ).on(table.audienceId, table.sortOrder),
  }),
);

export const abmAccounts = pgTable(
  "abm_accounts",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    organizationId: text("organization_id").notNull(),
    name: text("name").notNull(),
    domain: text("domain"),
    status: text("status").notNull().default("discovered"),
    accountData: jsonb("account_data"),
    providerData: jsonb("provider_data"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    organizationDomainUnique: unique("abm_accounts_org_domain_unique").on(
      table.organizationId,
      table.domain,
    ),
    organizationNameUnique: unique("abm_accounts_org_name_unique").on(
      table.organizationId,
      table.name,
    ),
  }),
);

export const abmAudienceAccounts = pgTable(
  "abm_audience_accounts",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    audienceId: integer("audience_id")
      .notNull()
      .references(() => abmAudiences.id, { onDelete: "cascade" }),
    accountId: integer("account_id")
      .notNull()
      .references(() => abmAccounts.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("candidate"),
    fitScore: numeric("fit_score", { precision: 6, scale: 2 }),
    intentScore: numeric("intent_score", { precision: 6, scale: 2 }),
    priorityScore: numeric("priority_score", { precision: 6, scale: 2 }),
    confidenceScore: numeric("confidence_score", { precision: 6, scale: 2 }),
    rationale: text("rationale"),
    scoringData: jsonb("scoring_data"),
    lastEvaluatedAt: timestamp("last_evaluated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    audienceAccountUnique: unique("abm_audience_accounts_unique").on(
      table.audienceId,
      table.accountId,
    ),
  }),
);

export const abmContacts = pgTable(
  "abm_contacts",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    accountId: integer("account_id")
      .notNull()
      .references(() => abmAccounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    title: text("title"),
    email: text("email"),
    linkedinUrl: text("linkedin_url"),
    status: text("status").notNull().default("discovered"),
    contactData: jsonb("contact_data"),
    providerData: jsonb("provider_data"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    accountEmailUnique: unique("abm_contacts_account_email_unique").on(
      table.accountId,
      table.email,
    ),
  }),
);

export const abmAccountSignals = pgTable(
  "abm_account_signals",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    accountId: integer("account_id")
      .notNull()
      .references(() => abmAccounts.id, { onDelete: "cascade" }),
    audienceSignalId: integer("audience_signal_id").references(
      () => abmAudienceSignals.id,
      { onDelete: "set null" },
    ),
    signalType: text("signal_type").notNull(),
    sourceType: text("source_type"),
    sourceLabel: text("source_label"),
    externalId: text("external_id"),
    title: text("title"),
    summary: text("summary"),
    evidenceUrl: text("evidence_url"),
    signalData: jsonb("signal_data"),
    strengthScore: numeric("strength_score", { precision: 6, scale: 2 }),
    confidenceScore: numeric("confidence_score", { precision: 6, scale: 2 }),
    happenedAt: timestamp("happened_at", { withTimezone: true }),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    accountExternalSignalUnique: unique(
      "abm_account_signals_account_external_unique",
    ).on(table.accountId, table.sourceType, table.externalId),
    accountSignalDetectedIdx: index("abm_account_signals_account_detected_idx").on(
      table.accountId,
      table.detectedAt,
    ),
  }),
);
