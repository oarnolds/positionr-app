// app/(admin)/admin/prompts/page.tsx
//
// /admin/prompts → redirect naar de eerste actieve module. De sidebar in
// [slug]/page.tsx fungeert als het modules-overzicht.

import { redirect } from "next/navigation";

export default function PromptsIndexPage() {
  redirect("/admin/prompts/website-check");
}
