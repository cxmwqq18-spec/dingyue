import "server-only";

import { prisma } from "@/lib/prisma";

/** React hoists this server-rendered metadata into the document head. */
export async function AidreamcapesHomeKeywords() {
  const page = await prisma.livePage.findFirstOrThrow({
    where: { siteId: "site_aidreamcapes", slug: "/" },
    select: { contentJson: true }
  });
  const content = page.contentJson as { seo?: { keywords?: unknown } };
  const keywords = typeof content.seo?.keywords === "string" ? content.seo.keywords.trim() : "";
  if (!keywords) throw new Error("Current Aidreamcapes homepage keywords are required");
  return <meta content={keywords} name="keywords" />;
}
