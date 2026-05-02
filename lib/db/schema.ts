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

// ── Sessions ────────────────────────────────────────────────────────
// Eén tabel voor ALLE module-runs. input/output zijn JSONB.

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(), // → auth.users.id
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  moduleSlug: text("module_slug")
    .notNull()
    .references(() => modules.slug),
  status: sessionStatus("status").default("draft").notNull(),

  // Input + output
  input: jsonb("input").notNull(),
  output: jsonb("output"),

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

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ── Types ──────────────────────────────────────────────────────────

export type Profile = typeof profiles.$inferSelect;
export type Module = typeof modules.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
