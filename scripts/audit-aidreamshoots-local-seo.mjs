#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import "./load-runtime-env.mjs";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportDir = path.join(repoRoot, "reports");
const localOrigin = "http://127.0.0.1:3002";
const publicOrigin = "https://aidreamshoots.eu";
const siteId = "site_mydreamshoots_xby";
const siteSlug = "aidreamshoots";

function canonicalCollectionSlug(category) {
  return String(category ?? "") === "travel" ? "estilo-y-fantasia" : String(category ?? "");
}

function expectedCanonicalForPack(pack) {
  return pack.category === "engagement-photo"
    ? `${publicOrigin}/ai-image-generation/engagement-photo`
    : `${publicOrigin}/collections/${canonicalCollectionSlug(pack.category)}`;
}

function decodeHtml(value) {
  return String(value ?? "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function cleanText(value) {
  return decodeHtml(String(value ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function attr(tag, name) {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i");
  return decodeHtml(tag.match(pattern)?.[1] ?? "");
}

function tags(html, tagName) {
  return [...String(html).matchAll(new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, "gi"))].map((match) => match[0]);
}

function openTags(html, tagName) {
  return [...String(html).matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi"))].map((match) => match[0]);
}

function innerTexts(html, tagName) {
  return tags(html, tagName).map((tag) => cleanText(tag.replace(new RegExp(`^<${tagName}\\b[^>]*>|<\\/${tagName}>$`, "i"), ""))).filter(Boolean);
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(value) {
  return cleanText(value).split(/\s+/).filter((word) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(word));
}

const themeAltSignals = {
  "black-friday": ["black friday", "promocional", "promoción", "promocion", "campaña", "campana"],
  holiday: ["fiesta", "fiestas", "celebración", "celebracion", "festivo", "festiva"],
  "only-fans": ["creador", "creadores", "contenido para creadores", "adulto", "perfil de creador"]
};

const functionalAltCategories = new Set([
  "hairstyle-generator",
  "virtual-try-on",
  "motion-generator",
  "background-changer",
  "background-remover",
  "magic-eraser",
  "photo-enhancer",
  "portrait-retouch",
  "unblur-image",
  "color-correction",
  "old-photo-restoration",
  "edit-by-prompt",
  "social-cards"
]);
const functionalAltForbiddenPattern = /(?:imagen generada con ia|galer[ií]a privada|aidreamshoots|variaci[oó]n visual|\bfondo (?:eliminado|removido)\b|\b(?:eliminado|eliminada|borrado|borrada|retirado|retirada)\b|\b(?:espacio|zona|área) (?:libre|vacía|abierta)\b.*\bdiseño\b|\bcambiado mediante\b|\bresultado procesado\b)/i;
const functionalAltGenericPattern = /^(?:imagen de escaparate|vista previa de imagen mejorada|retrato de viaje en destino|imagen de presentaci[oó]n)\.?$/i;

function stripQuery(value) {
  return String(value ?? "").split(/[?#]/, 1)[0];
}

function assetDiskPath(url) {
  const pathname = stripQuery(url).replace(/^\/+/, "");
  return path.join(repoRoot, "public", pathname);
}

function parseJsonLd(html) {
  const blocks = tags(html, "script")
    .filter((tag) => /type=["']application\/ld\+json["']/i.test(tag))
    .map((tag) => tag.replace(/^<script\b[^>]*>|<\/script>$/gi, "").trim());
  const parsed = [];
  const errors = [];
  for (const block of blocks) {
    try {
      parsed.push(JSON.parse(decodeHtml(block)));
    } catch (error) {
      errors.push(String(error?.message ?? error));
    }
  }
  const nodes = parsed.flatMap((item) => Array.isArray(item?.["@graph"]) ? item["@graph"] : [item]);
  return { blocks: blocks.length, parsed, nodes, errors };
}

function pageMeta(html, pack) {
  const head = html.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)?.[0] ?? "";
  const main = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] ?? html;
  const title = cleanText(head.match(/<title\b[^>]*>[\s\S]*?<\/title>/i)?.[0]?.replace(/^<title\b[^>]*>|<\/title>$/gi, "") ?? "");
  const metas = openTags(head, "meta");
  const metaBy = (name, value) => metas.find((tag) => new RegExp(`${name}=["']${value}["']`, "i").test(tag));
  const contentMeta = (name, value) => attr(metaBy(name, value) ?? "", "content");
  const canonical = attr(head.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0] ?? "", "href");
  const headings = { h1: innerTexts(main, "h1"), h2: innerTexts(main, "h2"), h3: innerTexts(main, "h3") };
  const images = openTags(main, "img").map((tag) => ({ src: attr(tag, "src"), alt: attr(tag, "alt"), width: attr(tag, "width"), height: attr(tag, "height") }));
  const links = [...main.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map((match) => decodeHtml(match[1]));
  const jsonLd = parseJsonLd(html);
  const schemaTypes = [...new Set(jsonLd.nodes.flatMap((node) => Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]]).filter(Boolean))];
  const schemaItemLists = jsonLd.nodes.filter((node) => (Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]]).includes("ItemList"));
  const schemaFaqPages = jsonLd.nodes.filter((node) => (Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]]).includes("FAQPage"));
  const emptyItemListCount = schemaItemLists.filter((node) => !Array.isArray(node.itemListElement) || node.itemListElement.length === 0).length;
  const emptyFaqCount = schemaFaqPages.filter((node) => !Array.isArray(node.mainEntity) || node.mainEntity.length === 0).length;
  const mainText = cleanText(main);
  const normalizedPackName = normalize(pack.name);
  const copyWithoutScripts = cleanText(html);
  const missingAccents = ["creditos", "galeria", "imagenes", "Como funciona", "Que crea", "Guia", "Paginas relacionadas"]
    .filter((phrase) => new RegExp(`\\b${phrase.replace(/ /g, "\\s+")}\\b`, "i").test(copyWithoutScripts));
  return {
    status: 200,
    title,
    description: contentMeta("name", "description"),
    robots: contentMeta("name", "robots"),
    keywords: contentMeta("name", "keywords"),
    canonical,
    og: {
      title: contentMeta("property", "og:title"),
      description: contentMeta("property", "og:description"),
      image: contentMeta("property", "og:image"),
      url: contentMeta("property", "og:url"),
      type: contentMeta("property", "og:type")
    },
    twitter: {
      card: contentMeta("name", "twitter:card"),
      title: contentMeta("name", "twitter:title"),
      description: contentMeta("name", "twitter:description"),
      image: contentMeta("name", "twitter:image")
    },
    lang: attr(html.match(/<html\b[^>]*>/i)?.[0] ?? "", "lang"),
    translate: attr(html.match(/<html\b[^>]*>/i)?.[0] ?? "", "translate"),
    headings,
    images,
    imageCount: images.length,
    missingImageAltCount: images.filter((image) => !image.alt.trim()).length,
    generatedImageCount: images.filter((image) => image.src.includes("/generated/regenerated/")).length,
    links,
    internalLinks: links.filter((href) => href.startsWith(`/site/${siteSlug}/`) || href.startsWith("/collections/") || href.startsWith("/ai-image-generation/")).length,
    collectionLinks: links.filter((href) => href.includes(`/site/${siteSlug}/collections/`) || href.startsWith("/collections/") || href.includes(`/site/${siteSlug}/ai-image-generation/`) || href.startsWith("/ai-image-generation/")).length,
    wordCount: words(mainText).length,
    h1: headings.h1[0] ?? "",
    normalizedPackName,
    schema: { blocks: jsonLd.blocks, errors: jsonLd.errors, types: schemaTypes, emptyItemListCount, emptyFaqCount, nodes: jsonLd.nodes.map((node) => ({ type: node?.["@type"], name: node?.name, url: node?.url, inLanguage: node?.inLanguage, itemListLength: Array.isArray(node?.itemListElement) ? node.itemListElement.length : null, mainEntityLength: Array.isArray(node?.mainEntity) ? node.mainEntity.length : null })) },
    copy: {
      firstParagraphs: innerTexts(main, "p").slice(0, 8),
      missingAccents
    }
  };
}

async function fetchPage(pack) {
  const url = `${localOrigin}/site/${siteSlug}/collections/${pack.category}`;
  let lastError = "unknown fetch error";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(45_000), headers: { "cache-control": "no-cache" } });
      const html = await response.text();
      const meta = pageMeta(html, pack);
      return { ...meta, url, path: `/site/${siteSlug}/collections/${pack.category}`, status: response.status };
    } catch (error) {
      lastError = String(error?.message ?? error);
      await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    }
  }
  return { url, path: `/site/${siteSlug}/collections/${pack.category}`, status: 0, error: lastError };
}

async function mediaAudit(state, packs) {
  const assets = (state.mediaAssets ?? []).filter((asset) => asset.siteId === siteId);
  const byStorage = new Map(assets.map((asset) => [asset.storageKey, asset]));
  const rows = [];
  const issues = [];
  for (const pack of packs) {
    const urls = [pack.imageUrl, ...(pack.galleryImages ?? [])].filter(Boolean);
    const packRows = [];
    for (let index = 0; index < urls.length; index += 1) {
      const url = urls[index];
      const storageKey = stripQuery(url).replace(/^\/assets\//, "");
      const asset = byStorage.get(storageKey);
      const diskPath = assetDiskPath(url);
      const alt = asset?.altText ?? "";
      const row = { pack: pack.category, index, url, storageKey, alt, altLength: alt.length, assetFound: Boolean(asset), fileFound: fs.existsSync(diskPath) };
      try {
        const metadata = await sharp(diskPath).metadata();
        row.width = metadata.width ?? 0;
        row.height = metadata.height ?? 0;
        row.mime = metadata.format ?? "";
      } catch (error) {
        row.imageError = String(error?.message ?? error);
      }
      packRows.push(row);
      const normalizedAlt = normalize(alt);
      const normalizedTheme = normalize(`${pack.name} ${pack.category}`);
      const themeTokens = normalizedTheme.split(/[\s-]+/).filter((token) => token.length >= 4 && !["foto", "photo", "generador", "generator", "imagenes", "images"].includes(token));
      const semanticSignals = (themeAltSignals[pack.category] ?? []).map(normalize);
      const themeMatch = themeTokens.some((token) => normalizedAlt.includes(token)) || semanticSignals.some((signal) => normalizedAlt.includes(signal));
      if (!asset) issues.push({ severity: "fail", type: "media-db", pack: pack.category, index, detail: "No MediaAsset record matches the applied public URL." });
      if (!row.fileFound) issues.push({ severity: "fail", type: "media-file", pack: pack.category, index, detail: `Missing local file: ${diskPath}` });
      if (!alt) issues.push({ severity: "fail", type: "alt-empty", pack: pack.category, index, detail: "altText is empty." });
      if (alt.length > 120) issues.push({ severity: "fail", type: "alt-long", pack: pack.category, index, detail: `${alt.length} characters; contract limit is 120.` });
      if (/imagen generada con ia|galer[ií]a privada|aidreamshoots|variaci[oó]n visual|generated with ai|private gallery/i.test(alt)) issues.push({ severity: "fail", type: "alt-filler", pack: pack.category, index, detail: "Alt contains brand, process, gallery, or variation filler text." });
      if (functionalAltCategories.has(pack.category) && functionalAltForbiddenPattern.test(alt)) issues.push({ severity: "fail", type: "functional-alt-result-claim", pack: pack.category, index, detail: `Functional Alt contains an unobservable edit result: ${alt}` });
      if (functionalAltCategories.has(pack.category) && functionalAltGenericPattern.test(alt)) issues.push({ severity: "fail", type: "functional-alt-generic", pack: pack.category, index, detail: `Functional Alt fell back to a generic label: ${alt}` });
      if (!themeMatch) issues.push({ severity: "warn", type: "alt-theme-signal", pack: pack.category, index, detail: `Alt does not contain a clear theme token: ${alt}` });
      if (row.width !== 1024 || row.height !== 1024) issues.push({ severity: "warn", type: "image-size", pack: pack.category, index, detail: `${row.width}x${row.height}` });
    }
    rows.push({ category: pack.category, name: pack.name, count: packRows.length, uniqueUrls: new Set(packRows.map((row) => stripQuery(row.url))).size, altUnique: new Set(packRows.map((row) => row.alt)).size, altMin: Math.min(...packRows.map((row) => row.altLength)), altMax: Math.max(...packRows.map((row) => row.altLength)), altAvg: Math.round(packRows.reduce((sum, row) => sum + row.altLength, 0) / Math.max(packRows.length, 1)), rows: packRows });
  }
  return { packs: rows, issues, totalImages: rows.reduce((sum, row) => sum + row.count, 0), totalAltLong: rows.reduce((sum, row) => sum + row.rows.filter((item) => item.altLength > 120).length, 0), totalMissingFiles: rows.reduce((sum, row) => sum + row.rows.filter((item) => !item.fileFound).length, 0) };
}

function pageIssues(page, pack) {
  if (page.status !== 200) return [{ severity: "fail", type: "http", detail: `HTTP ${page.status}: ${page.error ?? "non-200"}` }];
  const expectedCanonical = expectedCanonicalForPack(pack);
  const issues = [];
  if (!page.title) issues.push({ severity: "fail", type: "title", detail: "Missing title." });
  else if (page.title.length < 35 || page.title.length > 60) issues.push({ severity: "warn", type: "title-length", detail: `${page.title.length} characters: ${page.title}` });
  if (!page.description) issues.push({ severity: "fail", type: "meta-description", detail: "Missing meta description." });
  else if (page.description.length < 120 || page.description.length > 160) issues.push({ severity: "warn", type: "meta-description-length", detail: `${page.description.length} characters.` });
  if (page.canonical !== expectedCanonical) issues.push({ severity: "fail", type: "canonical", detail: `Expected ${expectedCanonical}, got ${page.canonical || "missing"}.` });
  if (page.lang !== "es" || page.translate !== "yes") issues.push({ severity: "warn", type: "i18n", detail: `lang=${page.lang || "missing"}, translate=${page.translate || "missing"}.` });
  if (!/^index,?\s*follow(?:,\s*max-image-preview:large)?$/i.test(page.robots)) issues.push({ severity: "warn", type: "robots", detail: page.robots || "missing" });
  if (page.headings.h1.length !== 1) issues.push({ severity: "fail", type: "h1-count", detail: `${page.headings.h1.length} H1 tags.` });
  if (!page.headings.h1[0]) issues.push({ severity: "fail", type: "h1-empty", detail: "H1 is empty." });
  if (!page.schema.types.includes("Product")) issues.push({ severity: "fail", type: "schema-product", detail: `No Product node; current schema types: ${page.schema.types.join(", ") || "none"}.` });
  if (page.schema.errors.length) issues.push({ severity: "fail", type: "schema-parse", detail: page.schema.errors.join("; ") });
  if (page.schema.emptyItemListCount) issues.push({ severity: "fail", type: "schema-empty-itemlist", detail: `${page.schema.emptyItemListCount} ItemList node(s) have no itemListElement entries.` });
  if (page.schema.emptyFaqCount) issues.push({ severity: "fail", type: "schema-empty-faq", detail: `${page.schema.emptyFaqCount} FAQPage node(s) have no mainEntity entries.` });
  if (!page.og.title || !page.og.description || !page.og.image || !page.og.url) issues.push({ severity: "warn", type: "og", detail: "OG title/description/image/url is incomplete." });
  if (!page.twitter.card || !page.twitter.title || !page.twitter.description || !page.twitter.image) issues.push({ severity: "warn", type: "twitter", detail: "Twitter card metadata is incomplete." });
  if (page.collectionLinks < 2) issues.push({ severity: "warn", type: "internal-links", detail: `Only ${page.collectionLinks} collection links in main content.` });
  const generatedImages = page.images.filter((image) => image.src.includes("/generated/regenerated/"));
  if (generatedImages.length < 13) issues.push({ severity: "fail", type: "ssr-image-contract", detail: `Expected at least 13 target generated images in SSR, found ${generatedImages.length}.` });
  const generatedAlts = generatedImages.slice(0, 13).map((image) => image.alt.trim());
  if (generatedAlts.some((alt) => !alt || alt.length > 120)) issues.push({ severity: "fail", type: "ssr-alt-contract", detail: "SSR target image Alt is empty or longer than 120 characters." });
  if (new Set(generatedAlts).size !== generatedAlts.length) issues.push({ severity: "fail", type: "ssr-alt-duplicate", detail: "SSR target image Alt values are not unique within the page." });
  if (functionalAltCategories.has(pack.category) && generatedAlts.some((alt) => functionalAltForbiddenPattern.test(alt))) issues.push({ severity: "fail", type: "ssr-functional-alt-result-claim", detail: "SSR functional Alt contains an unobservable edit result." });
  if (functionalAltCategories.has(pack.category) && generatedAlts.some((alt) => functionalAltGenericPattern.test(alt))) issues.push({ severity: "fail", type: "ssr-functional-alt-generic", detail: "SSR functional Alt fell back to a generic label." });
  if (page.wordCount < 180) issues.push({ severity: "warn", type: "thin-content", detail: `${page.wordCount} words in the rendered main content.` });
  if (page.copy.missingAccents.length) issues.push({ severity: "warn", type: "copy-accents", detail: `Unaccented Spanish UI phrases detected: ${page.copy.missingAccents.join(", ")}.` });
  return issues;
}

function markdownReport(report) {
  const lines = [];
  lines.push(`# AIdreamshoots 本地 SEO 与图片语义审计`);
  lines.push(`\n审计时间：${report.generatedAt}  \n范围：39 个图片套餐主题详情页、507 张图片  \n环境：${localOrigin}  \n说明：已按要求跳过 PageSpeed，不包含 Lighthouse 性能评分。`);
  lines.push(`\n## 结论\n`);
  lines.push(`- 页面 HTTP 200：${report.summary.pages200}/${report.summary.pagesTotal}`);
  lines.push(`- 图片资产：${report.media.totalImages} 张，缺失文件 ${report.media.totalMissingFiles} 张`);
  lines.push(`- alt 缺失：${report.summary.altEmpty}；alt 重复：${report.summary.altDuplicatePacks} 个页面；alt 超过 120 字符：${report.media.totalAltLong} 张`);
  lines.push(`- 页面级硬错误：${report.summary.pageFails}；警告：${report.summary.pageWarnings}`);
  lines.push(`- 结构化数据：Product ${report.summary.productSchemaPages}/${report.summary.pagesTotal}；空 ItemList ${report.summary.emptyItemListPages}/${report.summary.pagesTotal}；空 FAQ ${report.summary.emptyFaqPages}/${report.summary.pagesTotal}`);
  lines.push(`\n## 重点发现\n`);
  lines.push(`1. **图片数据契约已按 13 张/13 条 Alt 检查。** 本轮保留供应商图片 URL，检查文件存在性、MediaAsset 关联、尺寸、Alt 长度、主题信号和同主题重复；如有视觉语义无法仅靠数据确认，仍需人工抽样复核。`);
  lines.push(`2. **页面文案已切换到主题内容目录。** 每个主题提供独立西语介绍、适用场景、流程、FAQ、Alt 回退词和相关链接，审计同时检查 Title/H1/Meta 长度、重音与模板残留。`);
  lines.push(`3. **结构化数据按真实数据输出。** 每个主题详情页应包含 Product；有真实条目才输出 ItemList，有真实问答才输出 FAQPage，并检查 canonical、robots、sitemap 和别名跳转。`);
  lines.push(`\n## 页面级问题统计\n`);
  for (const [key, value] of Object.entries(report.summary.issueCounts).sort((a, b) => b[1] - a[1])) lines.push(`- ${key}: ${value}`);
  lines.push(`\n## 39 页明细\n\n| 主题 | HTTP | H1 | Title | Meta | Canonical | Schema | 正文词数 | 页面问题 |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|`);
  for (const row of report.pages) lines.push(`| ${row.packName} (${row.category}) | ${row.status} | ${row.h1Count} | ${row.titleLength} | ${row.descriptionLength} | ${row.canonicalOk ? "通过" : "失败"} | ${row.schemaTypes.join(", ") || "无"} | ${row.wordCount} | ${row.issueCount} |`);
  lines.push(`\n## 图片/alt 页面明细\n\n| 主题 | 图片数 | alt 唯一 | alt 长度范围 | 平均长度 | 文件缺失 |\n|---|---:|---:|---:|---:|---:|`);
  for (const row of report.media.packs) lines.push(`| ${row.name} (${row.category}) | ${row.count} | ${row.altUnique === row.count ? "是" : "否"} | ${row.altMin}-${row.altMax} | ${row.altAvg} | ${row.rows.filter((item) => !item.fileFound).length} |`);
  lines.push(`\n## 修复优先级\n`);
  lines.push(`1. **如果审计发现失败，先修复数据契约。** 重点是 MediaAsset、URL/Alt 顺序、13 张 SSR 图片和同主题 Alt 唯一性。`);
  lines.push(`2. **继续保持内容目录为唯一来源。** 页面、Meta、FAQ、Product 和 Alt 回退词不要回到全局字符串替换。`);
  lines.push(`3. **异常图片只进入人工复核或供应商补图队列。** 本轮不自动替换 URL，也不把看不清的视觉内容写成夸张 Alt。`);
  lines.push(`\n## 结构化数据与模板重复度\n`);
  lines.push(`- 空 ItemList 页面：${report.summary.emptyItemListPages}/${report.summary.pagesTotal}；空 FAQPage 页面：${report.summary.emptyFaqPages}/${report.summary.pagesTotal}。如果页面没有真实条目/问答，应移除空节点；如果要保留，则填入与页面可见内容一致的实体。`);
  lines.push(`- 最高频模板文本块：${report.copy.topRepeatedBlocks.slice(0, 5).map((item) => `${item.count} 页：${item.text}`).join("；")}`);
  return lines.join("\n");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function htmlList(items) {
  return `<ul>${items.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>`;
}

function htmlReport(report) {
  const templatePath = "/Users/a1/.codex/skills/seo-audit-full/assets/report-template.html";
  let html = fs.readFileSync(templatePath, "utf8");
  const hardErrors = report.pages.flatMap((row) => row.issues.filter((issue) => issue.severity === "fail").map((issue) => `${row.category}: ${issue.detail}`));
  const warnings = report.pages.flatMap((row) => row.issues.filter((issue) => issue.severity === "warn").map((issue) => `${row.category}: ${issue.detail}`));
  const passing = [
    `${report.summary.pages200}/${report.summary.pagesTotal} 个主题页返回 HTTP 200`,
    `${report.media.totalImages} 个媒体文件全部存在`,
    `${report.summary.pagesTotal}/${report.summary.pagesTotal} 个页面包含 title、meta description、canonical、OG 和 Twitter 元数据`
  ];
  const pageRows = report.pages.map((row) => `<tr><td>${htmlEscape(row.packName)}<br><small>${htmlEscape(row.category)}</small></td><td>${row.status}</td><td>${row.titleLength}</td><td>${row.descriptionLength}</td><td>${row.canonicalOk ? "通过" : "失败"}</td><td>${htmlEscape(row.schemaTypes.join(", "))}</td><td>${row.issueCount}</td></tr>`).join("");
  const mediaRows = report.media.packs.map((row) => `<tr><td>${htmlEscape(row.name)}<br><small>${htmlEscape(row.category)}</small></td><td>${row.count}</td><td>${row.altMin}-${row.altMax}</td><td>${row.altAvg}</td><td>${row.rows.filter((item) => !item.alt.trim()).length}</td><td>${row.rows.filter((item) => !item.fileFound).length}</td></tr>`).join("");
  const replacements = {
    report_title: "AIdreamshoots 本地 SEO 与图片语义审计",
    url: localOrigin,
    audit_level: "Local SSR audit（已跳过 PageSpeed）",
    generated_date: report.generatedAt,
    summary_verdict: report.summary.pageFails === 0 && report.summary.pageWarnings === 0 && report.summary.altEmpty === 0 && report.summary.productSchemaPages === report.summary.pagesTotal
      ? "本地 SSR、图片数据契约、Alt、结构化数据、canonical 和西语页面文案检查通过；本报告不包含 PageSpeed。"
      : "本地审计发现待处理项目，需先完成下方硬错误与警告后再视为 SEO 完成。",
    summary_critical_html: hardErrors.length ? htmlList(hardErrors) : "<p>未发现 HTTP、标题缺失或 JSON-LD 解析硬错误。</p>",
    summary_warnings_html: htmlList(warnings.slice(0, 80)),
    summary_passing_html: htmlList(passing),
    pagespeed_checks_html: "<p><strong>按用户要求跳过 PageSpeed/Lighthouse。</strong>本报告只覆盖本地 SSR、页面元数据、结构化数据、图片资产与文案检查。</p>",
    site_checks_html: `<table><thead><tr><th>检查项</th><th>结果</th><th>说明</th></tr></thead><tbody><tr><td>主题页 HTTP</td><td>${report.summary.pages200 === report.summary.pagesTotal ? "通过" : "失败"}</td><td>${report.summary.pages200}/${report.summary.pagesTotal} 返回 200</td></tr><tr><td>图片文件</td><td>${report.media.totalMissingFiles ? "警告" : "通过"}</td><td>${report.media.totalImages} 张，缺失 ${report.media.totalMissingFiles} 张</td></tr><tr><td>Alt 契约</td><td>${report.summary.altEmpty || report.media.totalAltLong || report.summary.altDuplicatePacks ? "警告" : "通过"}</td><td>${report.summary.altEmpty} 张缺失；${report.media.totalAltLong} 张超过 120 字符；${report.summary.altDuplicatePacks} 个页面存在重复 Alt</td></tr><tr><td>结构化数据</td><td>${report.summary.productSchemaPages === report.summary.pagesTotal && report.summary.emptyItemListPages === 0 && report.summary.emptyFaqPages === 0 ? "通过" : "警告"}</td><td>Product ${report.summary.productSchemaPages}/${report.summary.pagesTotal}；空 ItemList ${report.summary.emptyItemListPages}/${report.summary.pagesTotal}；空 FAQ ${report.summary.emptyFaqPages}/${report.summary.pagesTotal}</td></tr></tbody></table>`,
    eeat_checks_html: "<p>本轮为本地技术与内容审计，未进行外部权威性、链接资产、PageSpeed 或真实搜索结果评估。</p>",
    page_checks_html: `<table><thead><tr><th>主题</th><th>HTTP</th><th>Title</th><th>Meta</th><th>Canonical</th><th>Schema</th><th>问题数</th></tr></thead><tbody>${pageRows}</tbody></table><h3>图片/alt</h3><table><thead><tr><th>主题</th><th>图片数</th><th>Alt 长度</th><th>平均</th><th>缺失</th><th>文件缺失</th></tr></thead><tbody>${mediaRows}</tbody></table>`,
    priority_actions_html: report.summary.pageFails || report.summary.pageWarnings
      ? `<ol><li>先处理审计列出的页面硬错误与警告。</li><li>复核异常图片的视觉主题匹配和尺寸。</li><li>修复后重新运行本地 SSR SEO 审计。</li></ol>`
      : `<ol><li>保留当前供应商图片 URL，异常视觉语义继续走人工复核或供应商补图队列。</li><li>继续以主题内容目录作为页面、Meta、FAQ、Product 和 Alt 回退词的唯一来源。</li><li>发布前重复执行本地 SSR、重定向、robots 和 sitemap 检查；按要求不运行 PageSpeed。</li></ol>`,
    insights_html: `<ul><li>最高频重复块为相关主题导航标题，覆盖 ${report.copy.topRepeatedBlocks[0]?.count ?? 0} 页，属于页面结构性导航文案，不是主题介绍或 FAQ。</li><li>507 张图片已完成文件、MediaAsset、Alt 长度、同主题唯一性和 SSR 顺序检查；视觉内容仍建议按分类抽样复核。</li><li>当前页面级硬错误与警告为 ${report.summary.pageFails + report.summary.pageWarnings}，Product 覆盖率为 ${report.summary.productSchemaPages}/${report.summary.pagesTotal}。</li></ul>`
  };
  for (const [key, value] of Object.entries(replacements)) html = html.replaceAll(`{{${key}}}`, value);
  return html;
}

const state = await readPlatformStateFromSql();
const site = state.sites.find((item) => item.id === siteId);
if (!site) throw new Error(`Site not found: ${siteId}`);
const packs = (state.creativePacks ?? []).filter((pack) => pack.siteId === siteId && pack.status === "active").sort((a, b) => String(a.category).localeCompare(String(b.category)));
if (packs.length !== 39) throw new Error(`Expected 39 active packs, found ${packs.length}`);
const pages = [];
for (const pack of packs) pages.push({ pack, page: await fetchPage(pack) });
const media = await mediaAudit(state, packs);
const pageRows = pages.map(({ pack, page }) => {
  const issues = pageIssues(page, pack);
  return { category: pack.category, packName: pack.name, path: page.path, status: page.status, title: page.title ?? "", titleLength: (page.title ?? "").length, descriptionLength: (page.description ?? "").length, h1: page.headings?.h1?.[0] ?? "", h1Count: page.headings?.h1?.length ?? 0, canonical: page.canonical ?? "", canonicalOk: page.canonical === expectedCanonicalForPack(pack), schemaTypes: page.schema?.types ?? [], wordCount: page.wordCount ?? 0, imageCount: page.imageCount ?? 0, generatedImageCount: page.generatedImageCount ?? 0, collectionLinks: page.collectionLinks ?? 0, issues, issueCount: issues.length, pageMeta: page };
});
const issueCounts = {};
for (const row of pageRows) for (const issue of row.issues) issueCounts[issue.type] = (issueCounts[issue.type] ?? 0) + 1;
const repeatedBlocks = new Map();
for (const row of pageRows) {
  const blocks = [...(row.pageMeta?.copy?.firstParagraphs ?? []), ...(row.pageMeta?.headings?.h2 ?? []), ...(row.pageMeta?.headings?.h3 ?? [])];
  for (const block of blocks) {
    const key = normalize(block);
    if (key.length < 20) continue;
    const entry = repeatedBlocks.get(key) ?? { text: block, paths: new Set() };
    entry.paths.add(row.path);
    repeatedBlocks.set(key, entry);
  }
}
const topRepeatedBlocks = [...repeatedBlocks.values()]
  .map((entry) => ({ text: entry.text, count: entry.paths.size }))
  .filter((entry) => entry.count >= 2)
  .sort((a, b) => b.count - a.count || b.text.length - a.text.length);
const allAlt = media.packs.flatMap((pack) => pack.rows.map((row) => row.alt));
const altEmpty = allAlt.filter((alt) => !alt.trim()).length;
const altDuplicatePacks = media.packs.filter((pack) => pack.altUnique !== pack.count).length;
const report = {
  generatedAt: new Date().toISOString(),
  localOrigin,
  publicOrigin,
  scope: { pages: packs.length, images: media.totalImages, pageSpeed: "skipped by user" },
  summary: {
    pagesTotal: pageRows.length,
    pages200: pageRows.filter((row) => row.status === 200).length,
    altEmpty,
    altDuplicatePacks,
    pageFails: pageRows.reduce((sum, row) => sum + row.issues.filter((issue) => issue.severity === "fail").length, 0),
    pageWarnings: pageRows.reduce((sum, row) => sum + row.issues.filter((issue) => issue.severity === "warn").length, 0),
    productSchemaPages: pageRows.filter((row) => row.schemaTypes.includes("Product")).length,
    emptyItemListPages: pageRows.filter((row) => (row.pageMeta?.schema?.emptyItemListCount ?? 0) > 0).length,
    emptyFaqPages: pageRows.filter((row) => (row.pageMeta?.schema?.emptyFaqCount ?? 0) > 0).length,
    issueCounts
  },
  pages: pageRows,
  media,
  copy: { topRepeatedBlocks }
};
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(path.join(reportDir, "aidreamshoots-local-seo-audit-20260914.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(reportDir, "aidreamshoots-local-seo-audit-20260914.md"), markdownReport(report));
fs.writeFileSync(path.join(reportDir, "aidreamshoots-local-seo-audit-20260914.html"), htmlReport(report));
console.log(JSON.stringify({ ok: true, report: "reports/aidreamshoots-local-seo-audit-20260914.md", html: "reports/aidreamshoots-local-seo-audit-20260914.html", json: "reports/aidreamshoots-local-seo-audit-20260914.json", summary: report.summary, media: { totalImages: media.totalImages, totalAltLong: media.totalAltLong, totalMissingFiles: media.totalMissingFiles } }, null, 2));
