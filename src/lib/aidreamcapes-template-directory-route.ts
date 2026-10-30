import "server-only";
import { permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

/**
 * The retired /templates/photo and /templates/video catalogs redirect to the
 * /templates example gallery. Callers pass the route-mode base path: empty on
 * the public host (the canonical URL), /site/<slug> in embedded preview
 * contexts. The redirect is permanent — the catalogs are retired for good.
 */
export async function redirectLegacyAidreamcapesTemplateDirectory(siteSlug: string | undefined, path: string, basePath = "") {
  if (siteSlug !== "aidreamcapes" && siteSlug !== "aivideosugc") return;
  if (path !== "/templates/photo" && path !== "/templates/video") return;
  const owner = await prisma.livePage.findUnique({
    where: { siteId_slug: { siteId: "site_aidreamcapes", slug: path } }, select: { id: true },
  });
  if (!owner) permanentRedirect(`${basePath}/templates`);
}
