import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { markdownSnapshots } from "@/lib/db/schema";

function sanitizeFilename(name: string): string {
  const trimmed = name
    .replace(/^https?:\/\//, "")
    .replace(/[\/\\?%*:|"<>]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return trimmed || "markdown";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const { snapshotId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const [snapshot] = await db
    .select()
    .from(markdownSnapshots)
    .where(
      and(
        eq(markdownSnapshots.id, snapshotId),
        eq(markdownSnapshots.userId, user.id)
      )
    )
    .limit(1);
  if (!snapshot) return new Response("Not found", { status: 404 });

  const base =
    snapshot.title || snapshot.sourceFilename || snapshot.sourceUrl || "markdown";
  const filename = `${sanitizeFilename(base)}.md`;

  return new Response(snapshot.markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
