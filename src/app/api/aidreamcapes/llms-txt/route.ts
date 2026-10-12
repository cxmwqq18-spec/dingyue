import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// aidreamcapes.com/llms.txt (the middleware rewrites that path here for the
// aidreamcapes.com host only): a plain-text summary for AI assistants. The text is
// stored on the /about-us LivePage (built with the page copy), so it stays aligned
// with the public storefront. Any other host gets a 404.
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
  const page = await prisma.livePage.findUnique({
    where: { siteId_slug: { siteId: "site_aidreamcapes", slug: "/about-us" } },
    select: { contentJson: true }
  });
  const content = page?.contentJson as { sections?: Record<string, { type?: string; settings?: { data?: { llmsText?: unknown } } }> } | null | undefined;
  const section = Object.values(content?.sections ?? {}).find((candidate) => candidate?.type === "aidreamcapes_v2_page");
  const text = section?.settings?.data?.llmsText;
  if (typeof text !== "string" || !text.trim()) return notFound();
  return new Response(text, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
      "vary": "Host, X-Forwarded-Host"
    }
  });
}
