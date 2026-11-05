import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// www.aivideosugc.com/llms-full.txt (middleware rewrites that path here): the
// full-content companion of /llms.txt for AI assistants. The text is generated
// from the public pages into public/llms-full.txt (committed); served from disk
// so a regeneration only needs the file + a deploy. Any other host gets a 404.
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
  const file = path.join(process.cwd(), "public", "llms-full.txt");
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return notFound();
  }
  if (!text.trim()) return notFound();
  return new Response(text, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
      "vary": "Host, X-Forwarded-Host"
    }
  });
}
