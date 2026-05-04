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
  WebformAnswers,
  type WebsiteSnapshot,
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
        analysisMode: "snel",
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
    const { snapshot, cached } = await getOrFreshSnapshot(client.id, url);
    if (!cached) await persistSnapshot(client.id, snapshot);

    const phase1Result = await analyzeWithCachedSystem({
      system: buildPhase1SystemPrompt(),
      user: buildPhase1UserPrompt(snapshot),
      schema: Phase1Output,
    });

    await db
      .update(sessions)
      .set({
        status: "review",
        output: {
          phase1Output: phase1Result.data,
          webformAnswers: null,
          finalIcp: null,
          betrouwbaarheid: phase1Result.data.betrouwbaarheid_score,
        } as unknown as Record<string, unknown>,
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

  const currentOutput = (session.output ?? {}) as Record<string, unknown>;
  const currentAnswers = (currentOutput.webformAnswers ?? {}) as Partial<WebformAnswers>;
  const merged = { ...currentAnswers, ...answers };

  await db
    .update(sessions)
    .set({
      output: {
        ...currentOutput,
        webformAnswers: merged,
        webformStep: step,
      } as unknown as Record<string, unknown>,
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

  const output = (session.output ?? {}) as Record<string, unknown>;
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
    const finalResult = await analyzeWithCachedSystem({
      system: buildFinalIcpSystemPrompt(),
      user: buildFinalIcpUserPrompt({
        phase1,
        answers: parsed.data,
        companyName: client.name,
        analysisMode: "volledig",
      }),
      schema: FinalIcp,
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
        output: {
          ...output,
          webformAnswers: parsed.data,
          finalIcp: finalResult.data,
          positionering: finalResult.data.positionering,
        } as unknown as Record<string, unknown>,
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
