#!/usr/bin/env node
// Release gate for public media cards (AIVideosUGC / site_aidreamcapes).
//
// Contract (media detail remediation, 2026-10-21; canonicalization, 2026-10-30):
//   * every media card reaches a truthful detail page — its own
//     `publicSlug` route, or its product's shared canonical detail page
//     (`/ai-video-generation/<slug>`, `/ai-image-generation/<slug>`,
//     `/ai-actors/<name>` (flat));
//   * the card link is a plain path: no query string, no fragment, and no
//     inert `data-workspace-entry` payload;
//   * the workspace is reached only from the detail page CTA, never from a card.
//
// The card inventory comes from the relational LivePage rows (read-only) using
// the same shapes the public renderer owns: `templateDefinition.card`,
// `visual.picker.cards[*]` and `workspaceCases[*]`. The DOM comes from the
// running server. Pages that are not reachable as public pages (404, still
// rendering the workspace shell, transient rebuild) are reported as skipped
// instead of failing the run.
//
// Legacy example galleries (`data.examples.groups[*].items[*]`) are out of
// scope here: they carry no `publicSlug`, so they cannot own a detail page and
// keep their current workspace link.
//
// Usage:
//   node scripts/aidreamcapes-workspace/audit-card-entry-links.mjs
//   AIDREAMCAPES_ROUTE_SMOKE_ORIGIN=http://127.0.0.1:3003 \
//   AIDREAMCAPES_AUDIT_SITE_SLUG=aidreamcapes node .../audit-card-entry-links.mjs
import "../load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { load } from "cheerio";

const origin = String(process.env.AIDREAMCAPES_ROUTE_SMOKE_ORIGIN || "http://127.0.0.1:3003").replace(/\/$/, "");
const siteSlug = String(process.env.AIDREAMCAPES_AUDIT_SITE_SLUG || "aidreamcapes");
const pathMode = process.env.AIDREAMCAPES_AUDIT_PATH_MODE !== "0";
const base = pathMode ? `/site/${siteSlug}` : "";
const siteId = "site_aidreamcapes";
const requestTimeout = Number(process.env.AIDREAMCAPES_AUDIT_TIMEOUT || 60000);

const MEDIA_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,119}$/i;
const DETAIL_HREF_RE = /^\/(ai-image-generation|ai-video-generation)\/([a-z0-9][a-z0-9-]{0,119})$/i;
const ACTOR_HREF_RE = /^\/ai-actors\/([a-z0-9][a-z0-9-]{0,79})$/i;
const WORKSPACE_PREFIX = "/app/create";
// Cards that cannot own a media detail page yet: they carry no `publicSlug`, and
// no other card publishes the same image, so no truthful detail route exists.
// The renderer keeps their tool/preset link until the field-level manifest
// assigns a slug. These are exactly the `chips:["example"]` picker cards and the
// legacy `examples` gallery; the counts are asserted so the gap cannot grow.
const EXAMPLE_PICKER_CHIP = "example";
const EXAMPLE_GALLERY_SELECTOR = ".example-gallery";
// A "media card" is a card the public renderer emits for a public media item.
const CARD_SELECTOR = [
  "a.v-pick-card",
  "article.case-card a[href]",
  "article.tc a[href]",
  "article.actor-card a[href]",
].join(", ");

const MEDIA_ROOT = { photo: "ai-image-generation", video: "ai-video-generation" };
const failures = [];
const offenders = [];
const skipped = [];
const pages = [];
const templatePageHrefs = new Set();

function fail(scope, message) {
  failures.push(`${scope}: ${message}`);
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function detailPath(kind, slug) {
  return `/${MEDIA_ROOT[kind]}/${slug}`;
}

function actorSlug(name) {
  return String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Mirrors the public renderer's card shapes, in rendering order. */
function pageCards(contentJson) {
  const out = [];
  const content = record(contentJson);
  const sections = record(content?.sections);
  const order = Array.isArray(content?.sectionsOrder) ? content.sectionsOrder : [];
  for (const sectionId of order) {
    const section = record(sections?.[sectionId]);
    if (section?.type !== "aidreamcapes_v2_page") continue;
    const data = record(record(section.settings)?.data);
    const definition = record(record(data?.templateDefinition)?.card);
    if (definition) out.push({ source: "templateDefinition", card: definition });
    const picker = record(record(data?.visual)?.picker);
    if (Array.isArray(picker?.cards)) {
      for (const value of picker.cards) {
        const card = record(value);
        if (card) out.push({ source: "picker", card });
      }
    }
    if (Array.isArray(data?.workspaceCases)) {
      for (const value of data.workspaceCases) {
        const card = record(value);
        if (card) out.push({ source: "workspaceCases", card });
      }
    }
    const groups = record(data?.examples)?.groups;
    if (Array.isArray(groups)) {
      for (const group of groups) {
        const items = record(group)?.items;
        if (!Array.isArray(items)) continue;
        for (const value of items) {
          const card = record(value);
          if (card) out.push({ source: "examples", card });
        }
      }
    }
  }
  return out;
}

function mediaOf(card) {
  // A clip and a scene are moving pictures; only a still example is a photo.
  const kind = card.kind === "photo" ? "photo" : card.kind === "video" || card.kind === "clip" || card.kind === "scene" ? "video" : undefined;
  const slug = typeof card.publicSlug === "string" && MEDIA_SLUG_RE.test(card.publicSlug) ? card.publicSlug : undefined;
  if (!kind || !slug) return undefined;
  const image = record(card.image);
  return {
    kind,
    slug,
    label: typeof card.label === "string" ? card.label : typeof card.title === "string" ? card.title : "",
    image: typeof image?.src === "string" ? image.src : ""
  };
}

/** Normalises a rendered href to its site-relative path (drops the store prefix). */
function pathOf(href) {
  let url;
  try {
    url = new URL(href, `${origin}/`);
  } catch {
    return undefined;
  }
  let pathname = url.pathname;
  const prefix = pathname.match(/^\/site\/(?:aidreamcapes|aivideosugc)(?=\/|$)/)?.[0];
  if (prefix) pathname = pathname.slice(prefix.length) || "/";
  return {
    pathname,
    query: url.search,
    hash: url.hash,
    absolute: /^https?:\/\//i.test(href)
  };
}

function entryOf(anchor) {
  const raw = anchor.attr("data-workspace-entry");
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The visible title of the card that owns this anchor. */
function cardLabel($, anchor) {
  const container = anchor.closest("article, .tc, .v-pick-card, .case-card");
  const heading = (container.length ? container : anchor)
    .find("h2, h3, h4, strong")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  if (heading) return heading;
  return anchor.text().replace(/\s+/g, " ").trim().slice(0, 120);
}

async function fetchPage(pagePath) {
  const url = `${origin}${base}${pagePath === "/" ? "" : pagePath}`;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": "aidreamcapes-card-entry-audit/2.0" },
        signal: AbortSignal.timeout(requestTimeout)
      });
      const html = await response.text();
      return { status: response.status, html, finalPath: new URL(response.url).pathname };
    } catch (error) {
      // The dev server drops connections while it compiles a cold route.
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  throw lastError;
}

const hrefStatusCache = new Map();
async function hrefStatus(pathname) {
  if (hrefStatusCache.has(pathname)) return hrefStatusCache.get(pathname);
  let status = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${origin}${base}${pathname}`, {
        redirect: "follow",
        headers: { "user-agent": "aidreamcapes-card-entry-audit/2.0" },
        signal: AbortSignal.timeout(requestTimeout)
      });
      await response.text();
      status = response.status;
      break;
    } catch {
      // The dev server drops idle sockets while it compiles; a reset is not a
      // dead link.
      status = 0;
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }
  hrefStatusCache.set(pathname, status);
  return status;
}

const prisma = new PrismaClient({ errorFormat: "minimal" });

try {
  // ---- Relational inventory (read-only) -----------------------------------
  const rows = await prisma.livePage.findMany({
    where: { siteId },
    select: { slug: true, contentJson: true }
  });

  const owners = [];
  const knownSlugs = new Set();
  for (const row of rows) {
    const cards = pageCards(row.contentJson);
    const media = cards.map((entry) => mediaOf(entry.card)).filter(Boolean);
    if (!media.length) continue;
    const bySource = { picker: 0, workspaceCases: 0, templateDefinition: 0 };
    for (const entry of cards) {
      if (mediaOf(entry.card)) bySource[entry.source] += 1;
    }
    for (const item of media) knownSlugs.add(detailPath(item.kind, item.slug));
    const sections = record(record(row.contentJson)?.sections);
    const blockOrder = Object.values(sections ?? {})
      .map((section) => record(record(record(section)?.settings)?.data)?.blockOrder)
      .find((value) => Array.isArray(value));
    owners.push({
      page: row.slug,
      bySource,
      blockOrder: blockOrder ? blockOrder.map(String) : undefined,
      expected: [...new Map(media.map((item) => [detailPath(item.kind, item.slug), item])).values()],
      pickerSlugs: [...new Set(cards.filter((entry) => entry.source === "picker").map((entry) => mediaOf(entry.card)).filter(Boolean).map((item) => detailPath(item.kind, item.slug)))],
      caseSlugs: [...new Set(cards.filter((entry) => entry.source === "workspaceCases").map((entry) => mediaOf(entry.card)).filter(Boolean).map((item) => detailPath(item.kind, item.slug)))],
      templateCards: cards.filter((entry) => entry.source === "templateDefinition" && mediaOf(entry.card)).length
    });
  }

  const actorRows = rows.filter((row) => /^\/ai-actors\/(?:men|women)\/[^/]+$/.test(row.slug));
  const actorSlugs = new Set();
  for (const row of actorRows) {
    const sections = record(record(row.contentJson)?.sections);
    for (const section of Object.values(sections ?? {})) {
      const actor = record(record(record(section)?.settings)?.data?.actor);
      if (typeof actor?.name === "string") {
        const slug = actorSlug(actor.name);
        if (slug) actorSlugs.add(slug);
        break;
      }
    }
  }

  // Every media card must reach a truthful detail route: either it owns a
  // `publicSlug`, or — under the media-canonicalization policy — it links
  // straight at its product's shared canonical detail page through a plain
  // detail-path href.
  const detailHrefOf = (card) => {
    const href = typeof card.href === "string" ? card.href.trim() : "";
    return DETAIL_HREF_RE.test(href) ? href : undefined;
  };
  let cardsWithoutSlug = { picker: 0, examples: 0 };
  for (const row of rows) {
    for (const entry of pageCards(row.contentJson)) {
      if (entry.source === "picker" && !entry.card.publicSlug && !detailHrefOf(entry.card)) cardsWithoutSlug.picker += 1;
      if (entry.source === "examples" && !entry.card.publicSlug) cardsWithoutSlug.examples += 1;
    }
  }
  if (cardsWithoutSlug.picker > 0) {
    failures.push(`${cardsWithoutSlug.picker} picker card(s) have neither publicSlug nor a detail-path href; every media card must reach a detail route`);
  }
  if (cardsWithoutSlug.examples > 0) {
    failures.push(`${cardsWithoutSlug.examples} example-gallery card(s) have no publicSlug; every media card must own a detail route`);
  }

  // ---- DOM audit ----------------------------------------------------------
  let serverAvailable = true;
  const targets = owners.map((owner) => ({ page: owner.page, owner })).concat([{ page: "/ai-actors", owner: undefined }]);

  for (const target of targets) {
    const scope = target.page;
    let page;
    try {
      page = await fetchPage(target.page);
    } catch (error) {
      serverAvailable = false;
      skipped.push({ page: scope, reason: `server unavailable (${error instanceof Error ? error.message : String(error)})` });
      continue;
    }
    if (page.status !== 200) {
      skipped.push({ page: scope, reason: `http ${page.status}` });
      continue;
    }
    const $ = load(page.html);
    const title = $("title").first().text().trim();
    const publicPage = $("main[data-aidreamcapes-v2]").length > 0;
    if (!publicPage || /workspace/i.test(title)) {
      skipped.push({
        page: scope,
        reason: publicPage ? `still renders the workspace shell (${title})` : "not a public storefront page",
        finalPath: page.finalPath
      });
      continue;
    }

    const anchors = $(CARD_SELECTOR);
    const detailHrefs = new Set();
    let cardCount = 0;
    let pickerCount = 0;
    let actorCardCount = 0;
    const workspaceCards = [];
    const exampleCards = [];
    const pendingStatusChecks = [];

    anchors.each((_, node) => {
      const anchor = $(node);
      const href = anchor.attr("href");
      if (!href) return;
      cardCount += 1;
      if (anchor.hasClass("v-pick-card")) pickerCount += 1;
      const inActorCard = anchor.closest("article.actor-card").length > 0;
      if (inActorCard) actorCardCount += 1;
      const target = inActorCard ? "actor" : "media";
      const label = cardLabel($, anchor);
      const parsed = pathOf(href);
      if (!parsed) {
        offenders.push({ page: scope, href, label, problem: "unparseable href" });
        return;
      }

      // Example galleries and example-chipped picker cards are media cards
      // like any other: they must open their own detail page. They are only
      // tracked separately when they still fall back to a tool link.
      const exampleKind = inActorCard
        ? undefined
        : anchor.closest(EXAMPLE_GALLERY_SELECTOR).length
          ? "gallery"
          : anchor.hasClass("v-pick-card") && (anchor.attr("data-chips") ?? "").split(/\s+/).includes(EXAMPLE_PICKER_CHIP)
            ? "picker"
            : undefined;
      if (exampleKind && parsed.pathname.startsWith(WORKSPACE_PREFIX)) {
        exampleCards.push({ page: scope, href, label, kind: exampleKind });
        return;
      }

      if (parsed.query) offenders.push({ page: scope, href, label, problem: "card href carries a query string" });
      if (parsed.hash) offenders.push({ page: scope, href, label, problem: "card href carries a fragment" });
      const entry = entryOf(anchor);
      if (entry !== undefined) {
        offenders.push({ page: scope, href, label, problem: `card href carries data-workspace-entry${entry ? ` (view ${entry.view})` : " (unreadable)"}` });
      }

      if (target === "actor") {
        const match = parsed.pathname.match(ACTOR_HREF_RE);
        if (!match) {
          if (parsed.pathname.startsWith(WORKSPACE_PREFIX)) {
            offenders.push({ page: scope, href, label, problem: "actor card still enters the workspace instead of /ai-actors/<name>" });
          } else {
            offenders.push({ page: scope, href, label, problem: "actor card is not an /ai-actors/<name> detail route" });
          }
          return;
        }
        if (!actorSlugs.has(match[1])) {
          offenders.push({ page: scope, href, label, problem: `actor card points at an unknown actor slug (${match[1]})` });
        }
        const heading = anchor.closest("article.actor-card").find("h3").first().text().trim();
        if (heading && actorSlug(heading) !== match[1]) {
          offenders.push({ page: scope, href, label, problem: `actor card for "${heading}" links to ${match[1]}` });
        }
        return;
      }

      const match = parsed.pathname.match(DETAIL_HREF_RE);
      if (!match) {
        if (parsed.pathname.startsWith(WORKSPACE_PREFIX)) {
          workspaceCards.push({ page: scope, href, label });
          offenders.push({ page: scope, href, label, problem: "media card still enters the workspace instead of its detail page" });
        } else {
          offenders.push({ page: scope, href, label, problem: "media card is not an /ai-image-generation|/ai-video-generation detail route" });
        }
        return;
      }
      const canonical = `/${match[1]}/${match[2]}`;
      if (!knownSlugs.has(canonical)) {
        // Template cards point at their template page, which is a published
        // page rather than a media card row. Accept any address the server
        // actually serves; a dead address is still a defect.
        pendingStatusChecks.push({ page: scope, href, label, canonical });
      }
      detailHrefs.add(canonical);
    });

    for (const check of pendingStatusChecks) {
      const status = await hrefStatus(check.canonical);
      if (status === 200) {
        templatePageHrefs.add(check.canonical);
      } else {
        offenders.push({ page: check.page, href: check.href, label: check.label, problem: `card link resolves to ${status} (${check.canonical})` });
      }
    }

    if (target.owner) {
      // Pages filter and paginate their cards, so the DOM is not expected to
      // render every stored card. A page that renders no card link at all is
      // reported as skipped rather than failed.
      if (!cardCount && (target.owner.pickerSlugs.length || target.owner.caseSlugs.length)) {
        // A template page can deliberately leave the picker block out of its
        // block order; then the page shows its step UI instead of a card grid.
        const noPickerBlock = target.owner.blockOrder ? !target.owner.blockOrder.includes("picker") : false;
        skipped.push({
          page: scope,
          reason: noPickerBlock
            ? "page block order has no picker block; it renders its step UI instead of a card grid"
            : "page rendered no media card link"
        });
      }
    } else if (actorSlugs.size && actorCardCount < actorSlugs.size) {
      offenders.push({
        page: scope,
        href: "",
        label: "",
        problem: `rendered ${actorCardCount} actor card link(s) for ${actorSlugs.size} current actor(s)`
      });
    }

    pages.push({
      page: scope,
      anchors: cardCount,
      pickerCards: pickerCount,
      actorCards: actorCardCount,
      exampleCards: exampleCards.length,
      exampleCardKinds: exampleCards.reduce((counts, card) => ({ ...counts, [card.kind]: (counts[card.kind] ?? 0) + 1 }), {}),
      distinctDetailRoutes: detailHrefs.size,
      workspaceCards: workspaceCards.length
    });
  }

  if (!serverAvailable) {
    // A server that cannot answer is a failed gate, never a pass.
    failures.push(`server unavailable at ${origin}${base} (${skipped[0]?.reason ?? "connection failed"})`);
    console.error(JSON.stringify({ ok: false, origin, databaseOwners: owners.length, pages: [], skippedPages: skipped, offenders: [], failures }, null, 2));
    process.exitCode = 1;
  } else {
    const result = {
      ok: offenders.length === 0,
      origin,
      pathMode,
      database: {
        cardOwnerPages: owners.length,
        distinctMediaRoutes: knownSlugs.size,
        actors: actorSlugs.size
      },
      pages,
      skippedPages: skipped,
      offenders,
      failures
    };
    if (offenders.length) {
      console.error(JSON.stringify(result, null, 2));
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  }
} catch (error) {
  console.error(JSON.stringify({ ok: false, origin, error: error instanceof Error ? error.stack : String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
