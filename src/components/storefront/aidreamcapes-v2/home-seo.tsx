import "server-only";
import { prisma } from "@/lib/prisma";

/** Homepage keywords share the current LivePage owner with title and description. */
export async function AidreamcapesHomeKeywords() {
  const page = await prisma.livePage.findFirstOrThrow({
    where: { siteId: "site_aidreamcapes", id: "site_aidreamcapes_home", slug: "/" },
    select: { contentJson: true }
  });
  const content = page.contentJson as { seo?: { keywords?: unknown } };
  const keywords = content.seo?.keywords;
  if (typeof keywords !== "string" || !keywords.trim()) {
    throw new Error("Aidreamcapes homepage requires current LivePage SEO keywords");
  }
  return <meta name="keywords" content={keywords} />;
}
