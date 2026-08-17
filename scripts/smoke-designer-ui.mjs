import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateFile = path.join(repoRoot, "data", "platform-state.json");
const outputDir = path.join(repoRoot, "output", "playwright");
const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

const siteId = "site_lumen";
const siteSlug = "lumen";
const pageId = "site_lumen_home";
const adminEmail = "owner@lumen.localhost";
const adminPassword = "lumen123";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readState() {
  return JSON.parse(fs.readFileSync(stateFile, "utf8"));
}

function writeState(state) {
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
}

function siteFromState(state) {
  const site = state.sites.find((item) => item.id === siteId);
  assert(site, "missing Lumen site");
  return site;
}

function homeFromSite(site) {
  const page = site.pages.find((item) => item.id === pageId || item.slug === "/");
  assert(page, "missing Lumen home page");
  return page;
}

function blockIdByTitle(page, sectionId, title) {
  const section = page.draftJson.sections[sectionId];
  const block = section?.blocks?.find((item) => item.settings?.title === title || item.settings?.question === title || item.settings?.label === title);
  assert(block?.id, `missing block titled ${title} in ${sectionId}`);
  return block.id;
}

function _sectionOrderFromState() {
  return homeFromSite(siteFromState(readState())).draftJson.sectionsOrder;
}

function pageFromStateBySlug(slug) {
  const site = siteFromState(readState());
  const page = site.pages.find((item) => item.slug === slug);
  assert(page, `missing page ${slug}`);
  return page;
}

function assertWeddingJourneyAlbum(page, sectionId = "album_1") {
  const section = page.draftJson.sections[sectionId];
  assert(section?.type === "album_gallery", `${page.slug} missing ${sectionId} album_gallery`);
  for (const field of ["eyebrow", "title", "subtitle", "imageUrl", "emptyTitle", "emptyBody", "showDownloads"]) {
    const value = section.settings?.[field];
    assert(value !== undefined && value !== null && String(value).trim() !== "", `${page.slug} ${sectionId} missing ${field}`);
  }
}

async function waitForDraftOrder(predicate, message) {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    const state = readState();
    const site = siteFromState(state);
    const home = homeFromSite(site);
    if (predicate(home.draftJson.sectionsOrder, home.draftJson.sections)) return home.draftJson;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(message);
}

function textIncludes(haystack, marker, context) {
  assert(String(haystack).includes(marker), `${context} missing ${marker}`);
}

async function request(pathname, { method = "GET", body, cookie, csrf, allowFailure = false } = {}) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    redirect: "manual",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...(csrf ? { "x-csrf-token": csrf } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.clone().json().catch(() => ({}));
  if (!allowFailure && !response.ok) {
    throw new Error(`${method} ${pathname} failed: ${response.status} ${JSON.stringify(json)}`);
  }
  return { response, json, text: () => response.text() };
}

function cookieFrom(response, name) {
  const raw = response.headers.get("set-cookie") ?? "";
  const parts = raw.split(/,(?=\s*[^;,]+=)/g).map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`)) ?? "";
  const cookie = match.split(";")[0];
  assert(cookie.includes("="), `missing cookie ${name}`);
  return cookie;
}

function cookieValue(cookie, name) {
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function draftMetaFrom(value) {
  const draftMeta = value?.draftMeta ?? value?.draftJson?.draftMeta;
  if (draftMeta?.revision && draftMeta?.etag) return draftMeta;
  const revision = Math.max(1, Number(value?.draftJson?.version ?? 1));
  return { revision, etag: `W/"${revision}-legacy"` };
}

function publishedVersionFromSite(site) {
  return Math.max(1, ...(site?.pages ?? []).map((page) => Number(page?.publishedJson?.version ?? 1)));
}

function publishSnapshotPayload(site, actor) {
  return {
    actor,
    expectedPageVersions: Object.fromEntries((site?.pages ?? []).map((page) => [page.id, draftMetaFrom(page)])),
    expectedSettingsVersion: draftMetaFrom(site?.themeSettings),
    expectedPublishedVersion: publishedVersionFromSite(site)
  };
}

async function ensureServer() {
  try {
    const response = await fetch(`${base}/site/${siteSlug}`, { redirect: "manual" });
    assert(response.status < 500, `server returned ${response.status}`);
  } catch (error) {
    throw new Error(`local server is not reachable at ${base}; start it with npm run dev before smoke:designer-ui. ${error instanceof Error ? error.message : ""}`);
  }
}

function fieldSelector(fieldId) {
  return `[data-designer-field-id="${fieldId}"]`;
}

async function expectDesignerSelection(page, sectionId, fields) {
  await page.locator(`[data-designer-tree-id="section:${sectionId}"]`).first().click();
  const panel = page.locator('[data-designer-layout="saas-property-inspector-panel"]');
  await panel.waitFor({ state: "visible", timeout: 10000 });
  await page.waitForFunction((id) => {
    const panelElement = document.querySelector('[data-designer-layout="saas-property-inspector-panel"]');
    return panelElement?.getAttribute("data-designer-selected-section-id") === id;
  }, sectionId);
  for (const fieldId of fields) {
    await page.locator(fieldSelector(fieldId)).first().waitFor({ state: "visible", timeout: 10000 });
  }
}

async function dragSectionTo(page, sourceSectionId, targetSectionId, position) {
  const source = page.locator(`[data-designer-tree-id="section:${sourceSectionId}"]`).first();
  const target = page.locator(`[data-designer-tree-id="section:${targetSectionId}"]`).first();
  await source.waitFor({ state: "visible", timeout: 10000 });
  await target.waitFor({ state: "visible", timeout: 10000 });
  const box = await target.boundingBox();
  assert(box, `missing drag target box for ${targetSectionId}`);
  await source.dragTo(target, {
    targetPosition: {
      x: Math.min(120, Math.max(2, box.width - 2)),
      y: position === "after" ? Math.max(2, box.height - 3) : 4
    }
  });
}

async function run() {
  await ensureServer();
  fs.mkdirSync(outputDir, { recursive: true });

  const originalState = readState();
  const originalSite = siteFromState(originalState);
  const originalHome = homeFromSite(originalSite);
  const originalPublishedHeadline = originalHome.publishedJson.sections.hero_1?.settings?.headline;
  assert(originalPublishedHeadline === "AI-Powered Wedding Photos in Any Destination", "Lumen home is not on the AI Wedding published baseline");
  const originalOrder = originalHome.draftJson.sectionsOrder;
  const _originalTrustIndex = originalOrder.indexOf("trust_1");
  const heroPrimaryBlockId = blockIdByTitle(originalHome, "hero_1", "See Examples");
  const santoriniBlockId = blockIdByTitle(originalHome, "destinations_1", "Santorini");
  const firstFaqBlockId = blockIdByTitle(originalHome, "faq_1", "Is this really AI-generated?");

  const { response: loginResponse } = await request(`/api/sites/${siteId}/admin/auth/login`, {
    method: "POST",
    body: { email: adminEmail, password: adminPassword }
  });
  const adminSessionCookie = cookieFrom(loginResponse, `site_admin_session_${siteId}`);
  const adminCsrfCookie = cookieFrom(loginResponse, `site_admin_csrf_${siteId}`);
  const adminCsrf = cookieValue(adminCsrfCookie, `site_admin_csrf_${siteId}`);
  assert(adminCsrf, "missing site admin CSRF cookie");
  const adminCookie = [adminSessionCookie, adminCsrfCookie].join("; ");

  let rightPaneWidth = 0;
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      baseURL: base,
      viewport: { width: 1440, height: 960 },
      extraHTTPHeaders: { cookie: adminCookie }
    });
    const page = await context.newPage();
    await page.goto(`/site/${siteSlug}/admin/design?pageId=${pageId}`, { waitUntil: "networkidle" });
    await page.locator('[data-designer-layout="saas-store-builder xfcart-fullscreen-section-editor saas-three-pane-builder"]').waitFor({ state: "visible", timeout: 20000 });

    rightPaneWidth = await page.locator('[data-designer-layout="saas-right-editor-pane"]').evaluate((node) => Math.round(node.getBoundingClientRect().width));
    assert(rightPaneWidth >= 430 && rightPaneWidth <= 480, `designer right pane width should stay near SaaS 454px, got ${rightPaneWidth}px`);

    for (const sectionId of [
      "hero_1",
      "metrics_1",
      "pain_points_1",
      "luxury_highlight_1",
      "workflow_1",
      "destinations_1",
      "examples_1",
      "proof_1",
      "pricing_1",
      "trust_1",
      "faq_1",
      "final_cta_1"
    ]) {
      await page.locator(`[data-designer-tree-id="section:${sectionId}"]`).first().waitFor({ state: "visible", timeout: 10000 });
    }

    await expectDesignerSelection(page, "hero_1", ["headline", "subheadline", "socialProofLabel", "imageUrl"]);
    await page.locator(`[data-designer-tree-id="block:${heroPrimaryBlockId}"]`).first().click();
    await page.locator(fieldSelector("label")).first().waitFor({ state: "visible", timeout: 10000 });
    await page.locator(fieldSelector("href")).first().waitFor({ state: "visible", timeout: 10000 });

    await expectDesignerSelection(page, "destinations_1", ["title", "tabs"]);
    await page.locator(`[data-designer-tree-id="block:${santoriniBlockId}"]`).first().click();
    for (const fieldId of ["title", "location", "description", "imageUrl", "tags"]) {
      await page.locator(fieldSelector(fieldId)).first().waitFor({ state: "visible", timeout: 10000 });
    }

    await expectDesignerSelection(page, "pricing_1", ["title", "subtitle", "featuredProductId", "productType"]);
    await page.locator(`${fieldSelector("featuredProductId")} .widget-selected-line`).first().waitFor({ state: "visible", timeout: 10000 });

    await expectDesignerSelection(page, "faq_1", ["title"]);
    await page.locator(`[data-designer-tree-id="block:${firstFaqBlockId}"]`).first().click();
    await page.locator(fieldSelector("question")).first().waitFor({ state: "visible", timeout: 10000 });
    await page.locator(fieldSelector("answer")).first().waitFor({ state: "visible", timeout: 10000 });

    await page.getByRole("button", { name: "全局配置" }).click();
    await page.getByText("页眉", { exact: true }).first().click();
    await page.locator('[data-designer-layout="saas-property-inspector-panel"][data-designer-selected-global-type="header"]').waitFor({ state: "visible", timeout: 10000 });
    for (const fieldId of ["title", "ctaLabel", "ctaHref"]) {
      await page.locator(fieldSelector(fieldId)).first().waitFor({ state: "visible", timeout: 10000 });
    }

    await page.getByRole("button", { name: "积木配置" }).click();
    await expectDesignerSelection(page, "faq_1", ["title"]);
    await page.locator('[data-designer-action="duplicate-section"]').first().click();
    const copiedFaqDraft = await waitForDraftOrder(
      (order, sections) => order.length === originalOrder.length + 1 && order.some((id) => id !== "faq_1" && sections[id]?.type === "faq"),
      "duplicating a section through the property panel did not create a draft section"
    );
    const copiedFaqId = copiedFaqDraft.sectionsOrder.find((id) => id !== "faq_1" && copiedFaqDraft.sections[id]?.type === "faq");
    assert(copiedFaqId, "could not resolve copied FAQ section id");
    const trustIndexAfterDuplicate = copiedFaqDraft.sectionsOrder.indexOf("trust_1");
    assert(trustIndexAfterDuplicate >= 0, "could not resolve trust section index after duplication");

    await expectDesignerSelection(page, "trust_1", ["title"]);
    await page.locator('[data-designer-action="move-down"]').first().click();
    await waitForDraftOrder(
      (order) => order.indexOf("trust_1") === trustIndexAfterDuplicate + 1,
      "moving a section down through the property panel did not change draft order"
    );
    await page.locator('[data-designer-action="move-up"]').first().click();
    await waitForDraftOrder(
      (order) => order.indexOf("trust_1") === trustIndexAfterDuplicate,
      "moving a section up through the property panel did not restore draft order"
    );

    await expectDesignerSelection(page, copiedFaqId, ["title"]);
    await page.locator('[data-designer-action="delete-selected"]').first().click();
    await waitForDraftOrder(
      (order, sections) => order.length === originalOrder.length && !sections[copiedFaqId],
      "deleting a duplicated section through the property panel did not remove it from draft"
    );

    await dragSectionTo(page, "trust_1", "pricing_1", "before");
    await waitForDraftOrder(
      (order) => order.indexOf("trust_1") < order.indexOf("pricing_1"),
      "dragging a section in the SaaS tree did not move it before the target section"
    );
    await dragSectionTo(page, "trust_1", "pricing_1", "after");
    await waitForDraftOrder(
      (order) => JSON.stringify(order) === JSON.stringify(originalOrder),
      "dragging a section in the SaaS tree did not restore the original section order"
    );

    await page.locator('[data-designer-action="industry-template-apply-all"] select').first().selectOption("wedding-story-house");
    await waitForDraftOrder(
      (order, sections) =>
        JSON.stringify(order) === JSON.stringify(originalOrder) &&
        sections.hero_1?.settings?.headline === "AI-Powered Wedding Photos in Any Destination" &&
        sections.pricing_1?.settings?.featuredProductId === "prod_lumen_premium",
      "applying the AI Wedding theme package to all pages did not restore the expected home draft"
    );
    const stateAfterThemeApply = readState();
    const siteAfterThemeApply = siteFromState(stateAfterThemeApply);
    assert(siteAfterThemeApply.pages.length >= 20, "AI Wedding full-site apply must keep at least 20 editable pages");
    assertWeddingJourneyAlbum(pageFromStateBySlug("/account"));
    assertWeddingJourneyAlbum(pageFromStateBySlug("/app/jobs/detail"));

    await page.screenshot({
      fullPage: true,
      path: path.join(outputDir, "lumen-designer-ui-smoke.png")
    });
    await browser.close();
  } catch (error) {
    await browser.close().catch(() => {});
    writeState(originalState);
    throw error;
  }

  const marker = `Designer UI smoke ${Date.now().toString(36)}`;
  const stateForDraft = readState();
  const siteForDraft = siteFromState(stateForDraft);
  const homeForDraft = homeFromSite(siteForDraft);
  const nextDraft = JSON.parse(JSON.stringify(homeForDraft.draftJson));
  nextDraft.sections.hero_1.settings.headline = marker;

  const { json: draftSave } = await request(`/api/sites/${siteId}/theme/pages/${pageId}/draft`, {
    method: "PUT",
    cookie: adminCookie,
    csrf: adminCsrf,
    body: {
      draftJson: nextDraft,
      expectedRevision: draftMetaFrom(homeForDraft).revision,
      expectedEtag: draftMetaFrom(homeForDraft).etag
    }
  });
  assert(draftSave.ok, "designer UI smoke draft save failed");

  const liveBeforePublish = await (await request(`/site/${siteSlug}`)).text();
  assert(!liveBeforePublish.includes(marker), "draft marker leaked to live storefront before publish");

  const previewAfterDraft = await (await request(`/site/${siteSlug}/admin/design/preview/${pageId}`, { cookie: adminCookie })).text();
  textIncludes(previewAfterDraft, marker, "designer draft preview");

  const stateForPublish = readState();
  const publishPayload = publishSnapshotPayload(siteFromState(stateForPublish), "smoke_designer_ui");
  if (draftSave.draftVersion?.revision && draftSave.draftVersion?.etag) {
    publishPayload.expectedPageVersions[pageId] = {
      revision: draftSave.draftVersion.revision,
      etag: draftSave.draftVersion.etag
    };
  }
  const { json: publish } = await request(`/api/sites/${siteId}/theme/pages/${pageId}/publish`, {
    method: "POST",
    cookie: adminCookie,
    csrf: adminCsrf,
    body: publishPayload
  });
  assert(publish.publishedVersion, "designer UI smoke publish did not create a version");

  const liveAfterPublish = await (await request(`/site/${siteSlug}`)).text();
  textIncludes(liveAfterPublish, marker, "live storefront after publish");

  const stateForRollback = readState();
  const siteForRollback = siteFromState(stateForRollback);
  const homeForRollback = homeFromSite(siteForRollback);
  const rollbackOnlyMarker = `${marker} rollback-only`;
  const rollbackDraft = JSON.parse(JSON.stringify(homeForRollback.draftJson));
  rollbackDraft.sections.hero_1.settings.headline = rollbackOnlyMarker;
  await request(`/api/sites/${siteId}/theme/pages/${pageId}/draft`, {
    method: "PUT",
    cookie: adminCookie,
    csrf: adminCsrf,
    body: {
      draftJson: rollbackDraft,
      expectedRevision: draftMetaFrom(homeForRollback).revision,
      expectedEtag: draftMetaFrom(homeForRollback).etag
    }
  });

  const liveBeforeRollback = await (await request(`/site/${siteSlug}`)).text();
  assert(!liveBeforeRollback.includes(rollbackOnlyMarker), "rollback-only draft leaked before rollback");

  const { json: rollback } = await request(`/api/sites/${siteId}/theme/pages/${pageId}/rollback`, {
    method: "POST",
    cookie: adminCookie,
    csrf: adminCsrf,
    body: { actor: "smoke_designer_ui" }
  });
  assert(rollback.ok, "designer UI smoke rollback failed");

  const rolledState = readState();
  const rolledHeadline = homeFromSite(siteFromState(rolledState)).draftJson.sections.hero_1.settings.headline;
  assert(rolledHeadline === marker, "rollback did not restore draft from latest published snapshot");

  const result = {
    designerUi: "ok",
    screenshot: path.relative(repoRoot, path.join(outputDir, "lumen-designer-ui-smoke.png")),
    rightPaneWidth,
    checkedSections: 12,
    checkedFieldGroups: ["hero", "hero_cta", "destination", "pricing", "faq", "global_header"],
    sectionOperations: ["duplicate", "moveDown", "moveUp", "dragReorder", "delete"],
    fullSiteThemeApply: true,
    draftIsolation: true,
    publish: true,
    rollback: true,
    restoredBaseline: originalPublishedHeadline
  };

  writeState(originalState);
  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
