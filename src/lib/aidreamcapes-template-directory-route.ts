import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

/** Preserve the existing gallery aliases until their current LivePage owners are created. */
export async function redirectLegacyAidreamcapesTemplateDirectory(siteSlug: string | undefined, path: string, basePath = "") {
  if (siteSlug !== "aidreamcapes" && siteSlug !== "aivideosugc") return;
  if (path !== "/templates/photo" && path !== "/templates/video") return;
  const owner = await prisma.livePage.findUnique({
    where: { siteId_slug: { siteId: "site_aidreamcapes", slug: path } }, select: { id: true },
  });
  if (!owner) redirect(`${basePath}/templates`);
}
