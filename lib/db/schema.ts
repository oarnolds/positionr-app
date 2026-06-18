import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";

// ── Enums ───────────────────────────────────────────────────────────

export const userRole = pgEnum("user_role", ["user", "admin"]);

export const sessionStatus = pgEnum("session_status", [
  "draft",
  "running",
  "review",
  "approved",
  "failed",
]);

export const moduleStatus = pgEnum("module_status", [
  "active",
  "soon",
  "disabled",
]);

export const providerEnum = pgEnum("provider", ["claude", "perplexity"]);

export const tierEnum = pgEnum("tier", ["fundament", "groei", "strategie"]);

export const billingIntervalEnum = pgEnum("billing_interval", [
  "monthly",
  "yearly",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "expired",
]);

export const leadStatusEnum = pgEnum("lead_status", [
  "running",
  "completed",
  "failed",
]);

// ── Profiles ────────────────────────────────────────────────────────
// 1-op-1 met auth.users via id (RLS koppelt op auth.uid())

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // = auth.users.id
  fullName: text("full_name"),
  companyName: text("company_name"),
  websiteUrl: text("website_url"),
  kvk: text("kvk"),
  role: userRole("role").default("user").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Modules ─────────────────────────────────────────────────────────
// Source-of-truth voor de catalogus + default prompts

export const modules = pgTable("modules", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  status: moduleStatus("status").default("soon").notNull(),
  defaultPrompt: text("default_prompt").notNull().default(""),
  provider: providerEnum("provider").default("claude").notNull(),
  minTier: tierEnum("min_tier").default("fundament").notNull(),
  parentSlug: text("parent_slug"), // null = top-level module; non-null = sub-prompt (bv. ICP-subs)
  formatExample: text("format_example"),
  outputSchema: jsonb("output_schema"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Clients ────────────────────────────────────────────────────────
// Per gebruiker: bedrijven die geanalyseerd worden. Kennishub.
// `facts` JSONB groeit met output van module-runs (canonieke staat).

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(), // = auth.users.id
  name: text("name").notNull(),
  websiteUrl: text("website_url"),
  kvk: text("kvk"),
  sector: text("sector"),
  facts: jsonb("facts").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── ICP Products ────────────────────────────────────────────────────
// Per klant: catalogus van producten/diensten. Auto-gedetecteerd via
// website-scan of handmatig toegevoegd. Elk product kan meerdere
// ICP-analyses hebben (sessions met productId).

export const prominentie = pgEnum("prominentie", ["hoog", "middel", "laag"]);

export const icpProducts = pgTable("icp_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  websiteUrl: text("website_url"),
  prominentie: prominentie("prominentie").default("middel").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Sessions ────────────────────────────────────────────────────────
// Eén tabel voor ALLE module-runs. input/output zijn JSONB.

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(), // → auth.users.id
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => icpProducts.id, { onDelete: "cascade" }),
  moduleSlug: text("module_slug")
    .notNull()
    .references(() => modules.slug),
  status: sessionStatus("status").default("draft").notNull(),

  // Input + output
  input: jsonb("input").notNull(),
  output: text("output"),

  // Audit-spoor van de prompt
  promptOverride: text("prompt_override"), // admin-edit per sessie
  promptUsed: text("prompt_used"),         // wat ER ECHT verstuurd is

  // Telemetrie voor unit economics
  llmModel: text("llm_model"),
  llmInputTokens: integer("llm_input_tokens"),
  llmOutputTokens: integer("llm_output_tokens"),
  llmCostCents: integer("llm_cost_cents"),

  // Foutafhandeling
  errorMessage: text("error_message"),

  // Deelbare link (publieke read-only URL)
  shareSlug: text("share_slug").unique(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ── Module Prompt History ───────────────────────────────────────────
// Snapshot van elke save/reset/restore-actie op modules.defaultPrompt.
// Wordt geschreven door admin-server-actions; gelezen door de version-history UI.

export const modulePromptHistory = pgTable("module_prompt_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  moduleSlug: text("module_slug")
    .notNull()
    .references(() => modules.slug, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  provider: providerEnum("provider").notNull(),
  savedBy: uuid("saved_by").notNull(), // = auth.users.id (admin)
  savedAt: timestamp("saved_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Subscriptions ───────────────────────────────────────────────────
// 1-op-1 met auth.users. Waarheid voor portal-toegang + tier-niveau.

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(), // = auth.users.id
  tier: tierEnum("tier").notNull(),
  interval: billingIntervalEnum("interval").notNull(),
  status: subscriptionStatusEnum("status").default("active").notNull(),
  currentPeriodEnd: timestamp("current_period_end", {
    withTimezone: true,
  }).notNull(),
  mollieCustomerId: text("mollie_customer_id"),
  mollieSubscriptionId: text("mollie_subscription_id"), // alleen bij 'monthly'
  molliePaymentId: text("mollie_payment_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Leads ───────────────────────────────────────────────────────────
// Uit de publieke gratis Website Check. Server-side ingevoegd (service-role).

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  websiteUrl: text("website_url").notNull(),
  status: leadStatusEnum("status").default("running").notNull(),
  result: jsonb("result"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ── Markdown Snapshots ──────────────────────────────────────────────
// Gedeelde voorbewerking: URL (of andere bron) → schone markdown.
// Wordt gebruikt door meerdere modules (website-check, icp-analyse, …)
// en gecached zodat dezelfde URL niet bij elke run opnieuw gescraped wordt.

export const markdownSnapshotKindEnum = pgEnum("markdown_snapshot_kind", [
  "website",
  "pdf",
  "docx",
  // Toekomstige soorten:
  // "linkedin_company",
  // "linkedin_person",
]);

export const markdownSnapshots = pgTable("markdown_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(), // = auth.users.id
  kind: markdownSnapshotKindEnum("kind").notNull(),
  // Voor 'website' is dit de URL. Voor 'pdf'/'docx' is dit een stabiele
  // identifier (storage path) — gebruikt als cache-sleutel en uniqueness.
  sourceUrl: text("source_url").notNull(),
  // Alleen voor file-kinds: origineel bestand voor display.
  sourceFilename: text("source_filename"),
  // Alleen voor file-kinds: pad in de 'markdown-sources' Supabase bucket.
  sourceStoragePath: text("source_storage_path"),
  title: text("title"),
  metaDescription: text("meta_description"),
  markdown: text("markdown").notNull(),
  pages: jsonb("pages")
    .$type<Array<{
      url: string;
      status: "ok" | "failed" | "empty";
      charCount: number;
      errorMessage?: string;
    }>>()
    .default([])
    .notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// ── Types ──────────────────────────────────────────────────────────

export type Profile = typeof profiles.$inferSelect;
export type Module = typeof modules.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type IcpProduct = typeof icpProducts.$inferSelect;
export type NewIcpProduct = typeof icpProducts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type ModulePromptHistory = typeof modulePromptHistory.$inferSelect;
export type NewModulePromptHistory = typeof modulePromptHistory.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type MarkdownSnapshot = typeof markdownSnapshots.$inferSelect;
export type NewMarkdownSnapshot = typeof markdownSnapshots.$inferInsert;
