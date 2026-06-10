import { redirect } from "next/navigation";

/**
 * /admin/layouts → redirect naar de enige actieve layout-module (v1).
 * Bij meerdere modules: pak eerste uit een centrale registry.
 */
export default function LayoutsIndexPage() {
  redirect("/admin/layouts/website-check");
}
