import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { clients, sessions } from "@/lib/db/schema";
import { analyzeWithCachedSystem } from "@/lib/ai/claude";
import { scrapeForIcp } from "./scraper";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import {
  ICPOutput,
  type ICPInput,
  type ICPFactEntry,
  type WebsiteSnapshot,
} from "./schema";

const MODULE_SLUG = "icp-analyse";

/**
 * Voer ICP-analyse uit voor een klant + product.
 * Houdt sessions-rij bij (audit) en updatet clients.facts (canoniek).
 * Retourneert sessionId; gooit op fout (waarna sessions.status = 'failed').
 */
export async function runICPAnalysis(
  userId: string,
  input: ICPInput
): Promise<string> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, input.clientId))
    .limit(1);

  if (!client) throw new Error("Klant niet gevonden");
  if (client.userId !== userId) throw new Error("Geen toegang tot deze klant");
  if (!client.websiteUrl) throw new Error("Klant heeft geen website-URL — vul eerst in");

  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      clientId: client.id,
      moduleSlug: MODULE_SLUG,
      status: "running",
      input: input as unknown as Record<string, unknown>,
    })
    .returning();

  try {
    const existingFacts = (client.facts ?? {}) as Record<string, unknown>;
    const cachedSnapshot = existingFacts.website_snapshot as
      | WebsiteSnapshot
      | undefined;
    const snapshotAge = cachedSnapshot
      ? Date.now() - new Date(cachedSnapshot.scrapedAt).getTime()
      : Infinity;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const snapshot: WebsiteSnapshot =
      cachedSnapshot &&
      cachedSnapshot.url === client.websiteUrl &&
      snapshotAge < ONE_DAY_MS
        ? cachedSnapshot
        : await scrapeForIcp(client.websiteUrl);

    const system = buildSystemPrompt();
    const user = buildUserPrompt({
      bedrijfsnaam: client.name,
      product: input.product,
      productDescription: input.productDescription,
      snapshot,
    });

    const result = await analyzeWithCachedSystem({
      system,
      user,
      schema: ICPOutput,
    });

    await db
      .update(sessions)
      .set({
        status: "review",
        output: result.data as unknown as Record<string, unknown>,
        promptUsed: result.promptUsed,
        llmModel: result.llmModel,
        llmInputTokens: result.llmInputTokens,
        llmOutputTokens: result.llmOutputTokens,
        llmCostCents: result.llmCostCents,
        completedAt: new Date(),
      })
      .where(eq(sessions.id, session.id));

    const facts = { ...existingFacts };
    if (snapshot !== cachedSnapshot) {
      facts.website_snapshot = snapshot;
    }
    const existingICP = (facts.icp as ICPFactEntry[] | undefined) ?? [];
    const newEntry: ICPFactEntry = {
      product: input.product,
      sessionId: session.id,
      output: result.data,
      runAt: new Date().toISOString(),
      runIntent: input.runIntent,
    };

    let updatedICP: ICPFactEntry[];
    if (input.runIntent === "replace" || input.runIntent === "version") {
      const idx = existingICP.findIndex(
        (e) => e.product.toLowerCase() === input.product.toLowerCase()
      );
      if (idx >= 0) {
        updatedICP = [...existingICP];
        updatedICP[idx] = newEntry;
      } else {
        updatedICP = [...existingICP, newEntry];
      }
    } else {
      // 'new' of 'topic' → push als nieuwe entry
      updatedICP = [...existingICP, newEntry];
    }
    facts.icp = updatedICP;

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

/**
 * Detecteer of voor (clientId, product) al een ICP-fact bestaat.
 * Gebruikt door RerunDialog op input-pagina.
 */
export async function findExistingICP(
  clientId: string,
  product: string
): Promise<ICPFactEntry | null> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!client) return null;
  const facts = (client.facts ?? {}) as Record<string, unknown>;
  const icp = (facts.icp as ICPFactEntry[] | undefined) ?? [];
  const match = icp.find(
    (e) => e.product.toLowerCase() === product.toLowerCase()
  );
  return match ?? null;
}
