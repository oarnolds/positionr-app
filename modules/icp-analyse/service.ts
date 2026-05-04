import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { clients, icpProducts, sessions } from "@/lib/db/schema";
import { analyzeWithCachedSystem } from "@/lib/ai/claude";
import { scrapeForIcp } from "./scraper";
import {
  buildScanProductsSystemPrompt,
  buildScanProductsUserPrompt,
  buildPhase1SystemPrompt,
  buildPhase1UserPrompt,
  buildFinalIcpSystemPrompt,
  buildFinalIcpUserPrompt,
} from "./prompt";
import {
  ScannedProducts,
  Phase1Output,
  FinalIcp,
  type WebsiteSnapshot,
  type WebformAnswers,
  type ICPFactEntry,
  type ScannedProduct,
} from "./schema";

const MODULE_SLUG = "icp-analyse";

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

async function getOrFreshSnapshot(
  clientId: string,
  url: string
): Promise<{ snapshot: WebsiteSnapshot; cached: boolean }> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  const facts = (client?.facts ?? {}) as Record<string, unknown>;
  const cached = facts.website_snapshot as WebsiteSnapshot | undefined;
  const ONE_DAY = 24 * 60 * 60 * 1000;
  if (
    cached &&
    cached.url === url &&
    Date.now() - new Date(cached.scrapedAt).getTime() < ONE_DAY
  ) {
    return { snapshot: cached, cached: true };
  }
  const fresh = await scrapeForIcp(url);
  return { snapshot: fresh, cached: false };
}

async function persistSnapshot(clientId: string, snapshot: WebsiteSnapshot) {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  const facts = (client?.facts ?? {}) as Record<string, unknown>;
  facts.website_snapshot = snapshot;
  await db.update(clients).set({ facts }).where(eq(clients.id, clientId));
}

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

  // Snapshot
  const { snapshot, cached } = await getOrFreshSnapshot(clientId, url);
  if (!cached) await persistSnapshot(clientId, snapshot);

  // LLM-call
  const result = await analyzeWithCachedSystem({
    system: buildScanProductsSystemPrompt(),
    user: buildScanProductsUserPrompt(snapshot),
    schema: ScannedProducts,
  });

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
 * Snel-modus: scrape → Phase 1 → Phase 3 met empty webform → FinalIcp.
 * Maakt sessions-rij aan, retourneert sessionId.
 */
export async function runSnelAnalysis(
  userId: string,
  productId: string
): Promise<string> {
  const product = await getProductOrThrow(productId, userId);
  const client = await getClientOrThrow(product.clientId, userId);

  const url = product.websiteUrl ?? client.websiteUrl;
  if (!url) throw new Error("Geen website-URL voor dit product/klant");

  // Sessie aanmaken
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

  try {
    // Snapshot
    const { snapshot, cached } = await getOrFreshSnapshot(client.id, url);
    if (!cached) await persistSnapshot(client.id, snapshot);

    // Phase 1
    const phase1Result = await analyzeWithCachedSystem({
      system: buildPhase1SystemPrompt(),
      user: buildPhase1UserPrompt(snapshot),
      schema: Phase1Output,
    });

    // Phase 3 (met empty webform + product naam als strategischeDienst)
    const webformDefaults: WebformAnswers = {
      ...DEFAULT_WEBFORM_ANSWERS,
      strategischeDienst: product.name,
    };

    const finalResult = await analyzeWithCachedSystem({
      system: buildFinalIcpSystemPrompt(),
      user: buildFinalIcpUserPrompt({
        phase1: phase1Result.data,
        answers: webformDefaults,
        companyName: client.name,
      }),
      schema: FinalIcp,
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
        output: {
          phase1Output: phase1Result.data,
          webformAnswers: webformDefaults,
          finalIcp: finalResult.data,
          betrouwbaarheid: phase1Result.data.betrouwbaarheid_score,
          positionering: finalResult.data.positionering,
        } as unknown as Record<string, unknown>,
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

// ── 3/4. Volledig-modus orchestrators (B2 — placeholder) ────────────────────

// Phase 1 only — voor Volledig-flow review-pagina. Wordt B2 ingevuld.
// export async function runVolledigPhase1(userId: string, productId: string): Promise<string> {...}

// Phase 3 — na webform submit. B2.
// export async function runVolledigPhase3(userId: string, sessionId: string): Promise<void> {...}
