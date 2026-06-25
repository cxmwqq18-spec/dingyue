import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

const base = process.env.SITE_ADMIN_BASE_URL ?? process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3210";
const siteId = process.env.SITE_ADMIN_SITE_ID ?? "site_dreamshoot";
const username = process.env.SITE_ADMIN_USER;
const prisma = new PrismaClient();

async function createSmokeAdminSession() {
  const admin = username
    ? await prisma.siteAdmin.findUnique({
        where: { siteId_email: { siteId, email: username.trim().toLowerCase() } },
        select: { id: true }
      })
    : await prisma.siteAdmin.findFirst({
        where: { siteId },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: { id: true }
      });
  if (!admin) throw new Error(`missing_site_admin:${siteId}${username ? `:${username}` : ""}`);
  const session = await prisma.siteAdminSession.create({
    data: {
      id: `smoke_sasess_${randomUUID()}`,
      siteId,
      siteAdminId: admin.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    }
  });
  return {
    id: session.id,
    cookie: `site_admin_session_${siteId}=${session.id}`
  };
}

async function jsonFetch(path, init, cookie) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      cookie,
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path} failed ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

const smokeSession = await createSmokeAdminSession();
const cookie = smokeSession.cookie;
let packId = "";
try {
  const createBody = {
    name: `Smoke Prompt Pack ${Date.now()}`,
    headline: "Smoke Prompt Pack",
    description: "A temporary creative pack used to verify prompt defaults and cover image clearing.",
    prompt: "",
    category: "creative",
    aiAppSlug: "image_generator",
    status: "draft",
    creditCost: 1,
    outputCount: 2,
    trainingRequired: false,
    imageUrl: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png"
  };
  const created = await jsonFetch(`/api/sites/${siteId}/creative-packs`, {
    method: "POST",
    body: JSON.stringify(createBody)
  }, cookie);
  packId = created.pack?.id ?? "";
  if (!packId) throw new Error("missing_created_pack_id");
  if (!created.pack?.prompt?.includes("Theme: Smoke Prompt Pack.")) throw new Error("created_pack_prompt_was_not_generated");
  if (!created.pack?.imageUrl) throw new Error("created_pack_image_url_missing");

  const updated = await jsonFetch(`/api/sites/${siteId}/creative-packs/${packId}`, {
    method: "PUT",
    body: JSON.stringify({
      ...created.pack,
      prompt: "",
      imageUrl: ""
    })
  }, cookie);
  if (!updated.pack?.prompt?.includes("Theme: Smoke Prompt Pack.")) throw new Error("updated_pack_prompt_was_not_regenerated");
  if (updated.pack?.imageUrl) throw new Error("updated_pack_image_url_was_not_cleared");

  await jsonFetch(`/api/sites/${siteId}/creative-packs/${packId}`, { method: "DELETE" }, cookie);
  packId = "";
  console.log(JSON.stringify({ ok: true, createdPromptLength: created.pack.prompt.length, clearedImageUrl: true }, null, 2));
} finally {
  if (packId) {
    await jsonFetch(`/api/sites/${siteId}/creative-packs/${packId}`, { method: "DELETE" }, cookie).catch(() => undefined);
  }
  await prisma.siteAdminSession.deleteMany({ where: { id: smokeSession.id } }).catch(() => undefined);
  await prisma.$disconnect();
}
