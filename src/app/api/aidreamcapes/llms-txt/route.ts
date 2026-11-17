import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// aidreamcapes.com/llms.txt (the middleware rewrites that path here for the
// aidreamcapes.com host only): a plain-text summary for AI assistants. The text is
// stored on the /ai-info LivePage (built with the page copy), so it always states the
// same facts as the public page. Any other host gets a 404.
const AIDREAMCAPES_HOSTS = new Set(["www.aivideosugc.com", "aivideosugc.com", "aidreamcapes.com", "www.aidreamcapes.com"]);

function normalizeHost(value: string | null | undefined): string {
  return String(value ?? "").split(",")[0]?.trim().toLowerCase().split(":")[0] ?? "";
}

function notFound(): Response {
  return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}

export async function GET(request: Request): Promise<Response> {
  const hosts = [request.headers.get("x-forwarded-host"), request.headers.get("host")].map(normalizeHost);
  if (!hosts.some((host) => AIDREAMCAPES_HOSTS.has(host))) return notFound();
  const [page, guides] = await Promise.all([
    prisma.livePage.findUnique({
      where: { siteId_slug: { siteId: "site_aidreamcapes", slug: "/ai-info" } },
      select: { contentJson: true }
    }),
    prisma.livePage.findMany({
      where: { siteId: "site_aidreamcapes", slug: { startsWith: "/guides/" } },
      select: { slug: true, contentJson: true },
      orderBy: { slug: "asc" }
    })
  ]);
  const content = page?.contentJson as { sections?: Record<string, { type?: string; settings?: { data?: { llmsText?: unknown } } }> } | null | undefined;
  const section = Object.values(content?.sections ?? {}).find((candidate) => candidate?.type === "aidreamcapes_v2_page");
  const text = section?.settings?.data?.llmsText;
  if (typeof text !== "string" || !text.trim()) return notFound();
  const guideLines = guides
    .map((guide) => {
      const seo = (guide.contentJson as { seo?: { index?: boolean; title?: unknown } } | null)?.seo;
      if (seo?.index === false) return "";
      const title = typeof seo?.title === "string" ? seo.title.replace(/\s+/g, " ").trim() : "";
      return title ? `- [${title}](https://www.aivideosugc.com${guide.slug})` : "";
    })
    .filter(Boolean);
  // Guides publish from their own LivePage rows, so the summary lists them from
  // the same source instead of waiting for a hand-edited copy of this index.
  const body = guideLines.length
    ? `${text.replace(/\s*$/, "")}\n\n## Guides\n${guideLines.join("\n")}\n`
    : text;
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
      "vary": "Host, X-Forwarded-Host"
    }
  });
}
