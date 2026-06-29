import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { clients, icpProducts, sessions } from "@/lib/db/schema";
import { analyze } from "@/lib/ai/analyze";
import { getModulePrompt, substitutePlaceholders } from "@/lib/modules/prompts";
import { globalPlaceholders } from "@/lib/modules/global-placeholders";
import { scrapeForIcp } from "./scraper";
import { buildFinalContext, FALLBACK_PROMPT_SCAN } from "./prompt";
import {
  ScannedProducts,
  Phase1Output,
  FinalIcp,
  WebformAnswers,
  type WebsiteSnapshot,
  type ICPFactEntry,
  type ScannedProduct,
} from "./schema";

const MODULE_SLUG = "icp-analyse";
const PHASE1_SLUG = "icp-analyse-phase1";
const FINAL_SLUG = "icp-analyse-final";

// ── LLM-call helpers ────────────────────────────────────────────────────────
//
// SCAN: hardcoded prompt (niet admin-bewerkbaar — interne extractie-stap).
// PHASE1/FINAL: combineren parent (`icp-analyse`) met de modus-specifieke sub
// (`icp-analyse-phase1` of `-final`) — beide admin-bewerkbaar via /admin/prompts.

async function callScan(snapshot: WebsiteSnapshot) {
  const prompt = substitutePlaceholders(FALLBACK_PROMPT_SCAN, {
    ...globalPlaceholders(),
    websiteUrl: snapshot.url,
    scrapedContent: snapshot.bodyExcerpt,
  });
  // Provider hardcoded op claude (extractie-werk, geen web-search nodig).
  return analyze({ provider: "claude", prompt, schema: ScannedProducts });
}

/** Bouwt: parent-prompt + "\n\n" + sub-prompt (mag leeg zijn). */
async function composeIcpPrompt(
  subSlug: string,
  placeholders: Record<string, string>,
): Promise<{ prompt: string; provider: import("@/lib/ai/pricing").ConfigProvider }> {
  const parent = await getModulePrompt(MODULE_SLUG);
  const sub = await getModulePrompt(subSlug);
  const combined = sub.prompt
    ? `${parent.prompt}\n\n${sub.prompt}`
    : parent.prompt;
  return {
    prompt: substitutePlaceholders(combined, {
      ...globalPlaceholders(),
      ...placeholders,
    }),
    provider: parent.provider,
  };
}

async function callPhase1(snapshot: WebsiteSnapshot) {
  const { prompt, provider } = await composeIcpPrompt(PHASE1_SLUG, {
    websiteUrl: snapshot.url,
    scrapedContent: snapshot.bodyExcerpt,
  });
  return analyze({ provider, prompt, schema: Phase1Output });
}

async function callFinal(args: {
  phase1: import("./schema").Phase1Output;
  answers: import("./schema").WebformAnswers;
  companyName: string;
  analysisMode?: "snel" | "volledig";
}) {
  const context = buildFinalContext({
    phase1: args.phase1,
    answers: args.answers,
    analysisMode: args.analysisMode,
  });
  const { prompt, provider } = await composeIcpPrompt(FINAL_SLUG, {
    companyName: args.companyName,
    context,
  });
  return analyze({ provider, prompt, schema: FinalIcp });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getClientOrThrow(clientId: string, userId: string) {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!client) throw new Error("Klant niet gevonden");
  if (client.userId !== userId) throw new Error("Geen toegang tot deze klant");
  return client;
}

async function getProductOrThrow(productId: string, userId: string) {
  const [product] = await db
    .select()
    .from(icpProducts)
    .where(eq(icpProducts.id, productId))
    .limit(1);
  if (!product) throw new Error("Product niet gevonden");
  // Verifieer dat product bij een klant van deze user hoort
  await getClientOrThrow(product.clientId, userId);
  return product;
}

// Snapshot-caching gebeurt nu in `markdown_snapshots` (gedeeld over modules).
// `scrapeForIcp` haalt zelf uit cache of fetcht vers — geen aparte per-client
// website_snapshot meer nodig in `clients.facts`.

// ── 1. Scan website voor producten/diensten ─────────────────────────────────

/**
 * Scrapet website van een klant + laat Claude producten extraheren.
 * Slaat resultaten op als rijen in icp_products. Retourneert het aantal toegevoegde rijen.
 */
export async function scanWebsiteForProducts(
  userId: string,
  clientId: string,
  url: string
): Promise<{ products: ScannedProduct[]; saved: number }> {
  const client = await getClientOrThrow(clientId, userId);

  // Snapshot (gedeelde cache via markdown_snapshots)
  const snapshot = await scrapeForIcp(url, userId);

  // LLM-call (DB-prompt-gestuurd via getModulePrompt)
  const result = await callScan(snapshot);

  // Sla op als rijen
  const rows = result.data.producten.map((p) => ({
    clientId: client.id,
    name: p.naam,
    description: p.beschrijving,
    websiteUrl: snapshot.url,
    prominentie: p.prominentie,
  }));

  if (rows.length > 0) {
    await db.insert(icpProducts).values(rows);
  }

  return { products: result.data.producten, saved: rows.length };
}

// ── 2. Snel-modus: Phase 1 + auto Phase 3 met defaults ──────────────────────

const DEFAULT_WEBFORM_ANSWERS: WebformAnswers = {
  sectoren: [],
  bedrijfsgrootte: [],
  contactfunctie: "",
  beslisser: "",
  zelfdePersoon: true,
  pijnpunt: "",
  triggers: [],
  strategischeDienst: "",
  contractwaarde: "",
  idealeKenmerken: [],
  dealbreakers: [],
  vindkanalen: [],
  usp: "",
  eigenBeschrijving: "",
};

/**
 * Snel-modus, stap 1/2: valideer + maak sessie aan met status `running`.
 * Geeft sessionId terug zodat de caller meteen kan redirecten naar de
 * resultaatpagina (die polled). De echte LLM-werk wordt door
 * `runSnelInBackground(sessionId)` op de achtergrond gedaan.
 *
 * Gooit alleen bij validatie-fouten (URL ontbreekt, geen toegang, etc.) —
 * die laten zich netjes terug-redirecten met error-message in de URL.
 */
export async function createSnelSession(
  userId: string,
  productId: string,
): Promise<string> {
  const product = await getProductOrThrow(productId, userId);
  const client = await getClientOrThrow(product.clientId, userId);

  const url = product.websiteUrl ?? client.websiteUrl;
  if (!url) throw new Error("Geen website-URL voor dit product/klant");

  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      clientId: client.id,
      productId: product.id,
      moduleSlug: MODULE_SLUG,
      status: "running",
      input: { productId, analysisMode: "snel" } as unknown as Record<
        string,
        unknown
      >,
    })
    .returning();

  return session.id;
}

/**
 * Snel-modus, stap 2/2: scrape → Phase 1 → Phase 3 → updateSession.
 * Wordt op de achtergrond uitgevoerd via `after()` in de server-action.
 * Vangt zelf alle fouten en zet status='failed' — werpt nooit naar de caller
 * (after() heeft geen error-handler op de aanroeper).
 */
export async function runSnelInBackground(sessionId: string): Promise<void> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session || !session.productId || !session.clientId) {
    return; // sessie weg of incompleet — niets te doen
  }

  const userId = session.userId;
  const product = await getProductOrThrow(session.productId, userId);
  const client = await getClientOrThrow(product.clientId, userId);
  const url = product.websiteUrl ?? client.websiteUrl;

  if (!url) {
    await db
      .update(sessions)
      .set({
        status: "failed",
        errorMessage: "Geen website-URL voor dit product/klant",
        completedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));
    return;
  }

  try {
    // Snapshot (gedeelde cache via markdown_snapshots)
    const snapshot = await scrapeForIcp(url, userId);

    // Phase 1
    const phase1Result = await callPhase1(snapshot);

    // Phase 3 (met empty webform + product naam als strategischeDienst)
    const webformDefaults: WebformAnswers = {
      ...DEFAULT_WEBFORM_ANSWERS,
      strategischeDienst: product.name,
    };

    const finalResult = await callFinal({
      phase1: phase1Result.data,
      answers: webformDefaults,
      companyName: client.name,
      analysisMode: "snel",
    });

    // Combineer telemetrie
    const totalInputTokens =
      phase1Result.llmInputTokens + finalResult.llmInputTokens;
    const totalOutputTokens =
      phase1Result.llmOutputTokens + finalResult.llmOutputTokens;
    const totalCostCents =
      phase1Result.llmCostCents + finalResult.llmCostCents;

    await db
      .update(sessions)
      .set({
        status: "approved",
        output: JSON.stringify({
          phase1Output: phase1Result.data,
          webformAnswers: webformDefaults,
          finalIcp: finalResult.data,
          betrouwbaarheid: phase1Result.data.betrouwbaarheid_score,
          positionering: finalResult.data.positionering,
        }),
        promptUsed: `${phase1Result.promptUsed}\n\n=== FINAL ICP CALL ===\n${finalResult.promptUsed}`,
        llmModel: phase1Result.llmModel,
        llmInputTokens: totalInputTokens,
        llmOutputTokens: totalOutputTokens,
        llmCostCents: totalCostCents,
        completedAt: new Date(),
      })
      .where(eq(sessions.id, session.id));

    // Promote naar clients.facts.icp[]
    const [refreshedClient] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, client.id))
      .limit(1);
    const facts = (refreshedClient?.facts ?? {}) as Record<string, unknown>;
    const existingIcp = (facts.icp as ICPFactEntry[] | undefined) ?? [];
    const newEntry: ICPFactEntry = {
      productId: product.id,
      productName: product.name,
      sessionId: session.id,
      finalIcp: finalResult.data,
      runAt: new Date().toISOString(),
      analysisMode: "snel",
    };
    // Vervang oudere entry voor zelfde product, of push als nieuw
    const idx = existingIcp.findIndex((e) => e.productId === product.id);
    const updatedIcp =
      idx >= 0
        ? [
            ...existingIcp.slice(0, idx),
            newEntry,
            ...existingIcp.slice(idx + 1),
          ]
        : [...existingIcp, newEntry];
    facts.icp = updatedIcp;
    await db.update(clients).set({ facts }).where(eq(clients.id, client.id));
  } catch (err) {
    await db
      .update(sessions)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));
    // Geen throw: after() heeft geen error-handler op de caller.
    // De session is gemarkeerd als 'failed' — de result-pagina toont
    // dat netjes.
  }
}

// ── 3. Volledig-modus: Phase 1 (review) ─────────────────────────────────────

/**
 * Volledig-modus stap 1: scrape + Phase 1. Sessie krijgt status `review`
 * (wachten op user-review). Gebruiker bevestigt en gaat naar webform.
 */
export async function runVolledigPhase1(
  userId: string,
  productId: string
): Promise<string> {
  const product = await getProductOrThrow(productId, userId);
  const client = await getClientOrThrow(product.clientId, userId);

  const url = product.websiteUrl ?? client.websiteUrl;
  if (!url) throw new Error("Geen website-URL voor dit product/klant");

  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      clientId: client.id,
      productId: product.id,
      moduleSlug: MODULE_SLUG,
      status: "running",
      input: { productId, analysisMode: "volledig" } as unknown as Record<
        string,
        unknown
      >,
    })
    .returning();

  try {
    const snapshot = await scrapeForIcp(url, userId);

    const phase1Result = await callPhase1(snapshot);

    await db
      .update(sessions)
      .set({
        status: "review",
        output: JSON.stringify({
          phase1Output: phase1Result.data,
          webformAnswers: null,
          finalIcp: null,
          betrouwbaarheid: phase1Result.data.betrouwbaarheid_score,
        }),
        promptUsed: phase1Result.promptUsed,
        llmModel: phase1Result.llmModel,
        llmInputTokens: phase1Result.llmInputTokens,
        llmOutputTokens: phase1Result.llmOutputTokens,
        llmCostCents: phase1Result.llmCostCents,
      })
      .where(eq(sessions.id, session.id));

    return session.id;
  } catch (err) {
    await db
      .update(sessions)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      })
      .where(eq(sessions.id, session.id));
    throw err;
  }
}

// ── 4. Sla webform-antwoorden op (partial save voor resume) ─────────────────

export async function saveWebformAnswersPartial(
  userId: string,
  sessionId: string,
  answers: Partial<WebformAnswers>,
  step: number
): Promise<void> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session) throw new Error("Sessie niet gevonden");
  if (session.userId !== userId) throw new Error("Geen toegang");

  const currentOutput = (session.output ? JSON.parse(session.output) : {}) as Record<string, unknown>;
  const currentAnswers = (currentOutput.webformAnswers ?? {}) as Partial<WebformAnswers>;
  const merged = { ...currentAnswers, ...answers };

  await db
    .update(sessions)
    .set({
      output: JSON.stringify({
        ...currentOutput,
        webformAnswers: merged,
        webformStep: step,
      }),
    })
    .where(eq(sessions.id, sessionId));
}

// ── 5. Volledig-modus: Phase 3 (final) ──────────────────────────────────────

/**
 * Volledig-modus stap 2: combineer Phase 1 + webform-antwoorden → FinalIcp.
 * Gebruikt opgeslagen sessie-data. Status van running → approved.
 */
export async function runVolledigPhase3(
  userId: string,
  sessionId: string
): Promise<void> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session) throw new Error("Sessie niet gevonden");
  if (session.userId !== userId) throw new Error("Geen toegang");
  if (!session.productId || !session.clientId) {
    throw new Error("Sessie mist product- of klant-koppeling");
  }

  const output = (session.output ? JSON.parse(session.output) : {}) as Record<string, unknown>;
  const phase1 = output.phase1Output as Phase1Output | undefined;
  const rawAnswers = output.webformAnswers as
    | Partial<WebformAnswers>
    | undefined;

  if (!phase1) throw new Error("Phase 1 ontbreekt — eerst website-analyse uitvoeren");
  if (!rawAnswers) throw new Error("Webform-antwoorden ontbreken");

  // Valideer met zod (tolerant voor optional eigenBeschrijving)
  const parsed = WebformAnswers.safeParse(rawAnswers);
  if (!parsed.success) {
    throw new Error(
      `Webform-antwoorden onvolledig: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => i.path.join(".") + " " + i.message)
        .join(", ")}`
    );
  }

  const product = await getProductOrThrow(session.productId, userId);
  const client = await getClientOrThrow(session.clientId, userId);

  // Status → running
  await db
    .update(sessions)
    .set({ status: "running" })
    .where(eq(sessions.id, sessionId));

  try {
    const finalResult = await callFinal({
      phase1,
      answers: parsed.data,
      companyName: client.name,
      analysisMode: "volledig",
    });

    // Combineer telemetrie met bestaande Phase 1
    const totalInput =
      (session.llmInputTokens ?? 0) + finalResult.llmInputTokens;
    const totalOutput =
      (session.llmOutputTokens ?? 0) + finalResult.llmOutputTokens;
    const totalCost =
      (session.llmCostCents ?? 0) + finalResult.llmCostCents;

    await db
      .update(sessions)
      .set({
        status: "approved",
        output: JSON.stringify({
          ...output,
          webformAnswers: parsed.data,
          finalIcp: finalResult.data,
          positionering: finalResult.data.positionering,
        }),
        promptUsed: `${session.promptUsed ?? ""}\n\n=== FINAL ICP CALL ===\n${finalResult.promptUsed}`,
        llmInputTokens: totalInput,
        llmOutputTokens: totalOutput,
        llmCostCents: totalCost,
        completedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    // Promote naar clients.facts.icp[]
    const [refreshedClient] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, client.id))
      .limit(1);
    const facts = (refreshedClient?.facts ?? {}) as Record<string, unknown>;
    const existingIcp = (facts.icp as ICPFactEntry[] | undefined) ?? [];
    const newEntry: ICPFactEntry = {
      productId: product.id,
      productName: product.name,
      sessionId,
      finalIcp: finalResult.data,
      runAt: new Date().toISOString(),
      analysisMode: "volledig",
    };
    const idx = existingIcp.findIndex((e) => e.productId === product.id);
    const updatedIcp =
      idx >= 0
        ? [
            ...existingIcp.slice(0, idx),
            newEntry,
            ...existingIcp.slice(idx + 1),
          ]
        : [...existingIcp, newEntry];
    facts.icp = updatedIcp;
    await db.update(clients).set({ facts }).where(eq(clients.id, client.id));
  } catch (err) {
    await db
      .update(sessions)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));
    throw err;
  }
}
