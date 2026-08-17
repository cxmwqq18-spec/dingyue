import crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

const base = process.env.SITE_ADMIN_BASE_URL ?? process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3210";
const siteId = process.env.SITE_ADMIN_SITE_ID ?? "site_dreamshoot";
const username = process.env.SITE_ADMIN_USER;
const prisma = new PrismaClient();
const csrfSecret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "dev-csrf-secret-change-me";

function createCsrfToken(scope, sessionId) {
  const nonce = crypto.randomBytes(24).toString("base64url");
  const mac = crypto.createHmac("sha256", csrfSecret).update(`${scope}:${sessionId}:${nonce}`).digest("base64url");
  return `${nonce}.${mac}`;
}

function draftMetaFromSettingsDraft(draftJson) {
  const draftMeta = draftJson?.draftMeta;
  if (draftMeta?.revision && draftMeta?.etag) return draftMeta;
  const revision = Math.max(1, Number(draftJson?.version ?? 1));
  return { revision, etag: `W/"${revision}-legacy"` };
}

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
  const scope = `site-admin:${siteId}`;
  const sessionId = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`site_admin_session_${siteId}=`))?.split("=")[1];
  const csrfToken = sessionId ? createCsrfToken(scope, sessionId) : undefined;
  const csrfCookie = csrfToken ? `site_admin_csrf_${siteId}=${csrfToken}` : undefined;
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      cookie: csrfCookie ? `${cookie}; ${csrfCookie}` : cookie,
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path} failed ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

const smokeSession = await createSmokeAdminSession();
let originalDraft;

try {
  const settings = await prisma.themeSettings.findUnique({ where: { siteId } });
  if (!settings?.draftJson || typeof settings.draftJson !== "object" || Array.isArray(settings.draftJson)) {
    throw new Error(`missing_theme_settings:${siteId}`);
  }
  originalDraft = settings.draftJson;
  const pages = await prisma.themePage.findMany({
    where: { siteId },
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true, title: true }
  });
  const page = pages.find((item) => item.slug === "/pricing") ?? pages[0];
  if (!page) throw new Error(`missing_theme_page:${siteId}`);

  const nextDraft = {
    ...originalDraft,
    seo: {
      ...(originalDraft.seo ?? {}),
      siteTitle: originalDraft.seo?.siteTitle ?? "Smoke TDK Site",
      siteDescription: originalDraft.seo?.siteDescription ?? "Smoke TDK description.",
      siteKeywords: "smoke tdk, ai photo packages, metadata editor",
      titleTemplate: originalDraft.seo?.titleTemplate ?? "%s | Smoke TDK",
      defaultOgImage: originalDraft.seo?.defaultOgImage ?? "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
      robots: originalDraft.seo?.robots ?? { index: true, follow: true },
      pages: {
        ...(originalDraft.seo?.pages ?? {}),
        [page.id]: {
          ...(originalDraft.seo?.pages?.[page.id] ?? {}),
          title: "Smoke TDK Pricing Title",
          description: "Smoke TDK pricing description used to verify editable title, description, keywords, canonical and social image fields.",
          keywords: "pricing metadata, smoke keywords, ai subscription",
          canonicalPath: page.slug || "/pricing",
          ogImage: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png",
          index: true,
          follow: true
        }
      }
    }
  };

  await jsonFetch(`/api/sites/${siteId}/theme/settings/draft`, {
    method: "PUT",
    body: JSON.stringify({
      draftJson: nextDraft,
      expectedRevision: draftMetaFromSettingsDraft(originalDraft).revision,
      expectedEtag: draftMetaFromSettingsDraft(originalDraft).etag
    })
  }, smokeSession.cookie);

  const updated = await prisma.themeSettings.findUnique({ where: { siteId } });
  const seo = updated?.draftJson?.seo;
  if (seo?.siteKeywords !== nextDraft.seo.siteKeywords) throw new Error("site_keywords_not_saved");
  if (seo?.pages?.[page.id]?.keywords !== nextDraft.seo.pages[page.id].keywords) throw new Error("page_keywords_not_saved");
  if (seo?.pages?.[page.id]?.ogImage !== nextDraft.seo.pages[page.id].ogImage) throw new Error("page_og_image_not_saved");

  console.log(JSON.stringify({
    ok: true,
    pageId: page.id,
    siteKeywords: seo.siteKeywords,
    pageKeywords: seo.pages[page.id].keywords,
    pageOgImage: seo.pages[page.id].ogImage
  }, null, 2));
} finally {
  if (originalDraft) {
    await prisma.themeSettings.update({
      where: { siteId },
      data: { draftJson: originalDraft }
    }).catch(() => undefined);
  }
  await prisma.siteAdminSession.deleteMany({ where: { id: smokeSession.id } }).catch(() => undefined);
  await prisma.$disconnect();
}
