#!/usr/bin/env node

// Independent final gates for the Aidreamcapes EU SEO remediation.
// Deliberately excludes PageSpeed/Lighthouse.
import fs from "node:fs/promises";
import path from "node:path";

const origin = "https://aidreamcapes.eu";
const timeoutMs = Number(process.env.SEO_GATE_TIMEOUT_MS || 20_000);
const concurrency = Number(process.env.SEO_GATE_CONCURRENCY || 8);
const retiredRoutes = [
  "/ai-save-the-date/easter",
  "/ai-save-the-date/wedding-anniversary",
  "/ai-image-generation/estilo-y-fantasia",
  "/ai-image-generation/urbano",
  "/collections/soccer",
  "/collections/christmas-photo",
  "/collections/thanksgiving-photo",
  "/tools/image-studio",
  "/tools/seasonal-celebration-album-maker"
];
const sentinelRoutes = ["/undefined", "/null", "/test", "/old"];
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportBase = path.resolve("reports", `aidreamcapes-eu-final-seo-gates-${timestamp}`);

function compact(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return compact(value).toLocaleLowerCase("fr-FR").replace(/[\s\u00a0]+/g, " ");
}

function attr(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? "";
}

function meta(html, key, keyName = "name") {
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  const tag = tags.find((candidate) => normalize(attr(candidate, keyName)) === normalize(key));
  return attr(tag || "", "content");
}

function title(html) {
  return compact(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
}

function h1Count(html) {
  return [...html.matchAll(/<h1\b[^>]*>/gi)].length;
}

function canonical(html) {
  const tags = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
  const tag = tags.find((candidate) => /\brel\s*=\s*["'][^"']*canonical[^"']*["']/i.test(candidate));
  return attr(tag || "", "href");
}

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1].trim());
}

function collectNodes(value, nodes = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectNodes(item, nodes);
    return nodes;
  }
  if (!value || typeof value !== "object") return nodes;
  if (value["@type"]) nodes.push(value);
  for (const child of Object.values(value)) collectNodes(child, nodes);
  return nodes;
}

function schemaTypes(nodes) {
  return [...new Set(nodes.flatMap((node) => {
    const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
    return types.filter(Boolean).map(String);
  }))].sort();
}

function isType(node, expected) {
  const types = Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]];
  return types.includes(expected);
}

function absoluteUrl(value) {
  try {
    return new URL(value, origin).toString();
  } catch {
    return "";
  }
}

function routeOf(value) {
  try {
    return new URL(value, origin).pathname || "/";
  } catch {
    return value;
  }
}

async function fetchText(url, redirect = "follow") {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect,
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: "text/html,application/xml,text/plain" }
      });
      return {
        url: response.url,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: await response.text()
      };
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

async function mapLimit(values, limit, worker) {
  const results = new Array(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      results[index] = await worker(values[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function countMap(values) {
  const map = new Map();
  for (const value of values) {
    const key = normalize(value);
    if (!key) continue;
    map.set(key, [...(map.get(key) || []), value]);
  }
  return map;
}

function duplicateGroups(rows, field) {
  const map = new Map();
  for (const row of rows) {
    const key = normalize(row[field]);
    if (!key) continue;
    map.set(key, [...(map.get(key) || []), row.route]);
  }
  return [...map.entries()]
    .filter(([, routes]) => routes.length > 1)
    .map(([value, routes]) => ({ value, routes }));
}

function mdList(items, empty = "无") {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : `- ${empty}`;
}

async function main() {
  const sitemapUrl = `${origin}/sitemap.xml`;
  const sitemap = await fetchText(sitemapUrl);
  const sitemapLocs = [...sitemap.body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => match[1].trim());
  const sitemapUrls = [...new Set(sitemapLocs)];
  const sitemapHostProblems = sitemapUrls.filter((url) => {
    try { return new URL(url).hostname !== "aidreamcapes.eu"; } catch { return true; }
  });
  const routes = sitemapUrls.map(routeOf);

  const rows = await mapLimit(routes, concurrency, async (route) => {
    const url = `${origin}${route === "/" ? "/" : route}`;
    try {
      const response = await fetchText(url);
      const titleValue = title(response.body);
      const descriptionValue = meta(response.body, "description");
      const robotsValue = meta(response.body, "robots");
      const canonicalValue = canonical(response.body);
      const blocks = jsonLdBlocks(response.body);
      const parsed = [];
      const parseErrors = [];
      for (const raw of blocks) {
        try {
          parsed.push(JSON.parse(raw));
        } catch (error) {
          parseErrors.push(error instanceof Error ? error.message : String(error));
        }
      }
      const nodes = parsed.flatMap((value) => collectNodes(value));
      return {
        route,
        url,
        status: response.status,
        finalUrl: response.url,
        title: titleValue,
        titleLength: titleValue.length,
        description: descriptionValue,
        descriptionLength: descriptionValue.length,
        h1Count: h1Count(response.body),
        lang: (response.body.match(/<html\b[^>]*\blang=["']([^"']+)["']/i)?.[1] || ""),
        canonical: canonicalValue,
        canonicalAbsolute: absoluteUrl(canonicalValue),
        robots: robotsValue,
        jsonLdBlockCount: blocks.length,
        jsonLdValidBlockCount: parsed.length,
        jsonLdParseErrors: parseErrors,
        jsonLdTypes: schemaTypes(nodes),
        jsonLdNodes: nodes.map((node) => ({
          type: Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]],
          id: node["@id"] || "",
          url: node.url || "",
          inLanguage: node.inLanguage || "",
          sameAs: Array.isArray(node.sameAs) ? node.sameAs : [],
          contactPoint: node.contactPoint || null
        }))
      };
    } catch (error) {
      return {
        route,
        url,
        status: 0,
        finalUrl: "",
        title: "",
        titleLength: 0,
        description: "",
        descriptionLength: 0,
        h1Count: 0,
        lang: "",
        canonical: "",
        canonicalAbsolute: "",
        robots: "",
        jsonLdBlockCount: 0,
        jsonLdValidBlockCount: 0,
        jsonLdParseErrors: [error instanceof Error ? error.message : String(error)],
        jsonLdTypes: [],
        jsonLdNodes: []
      };
    }
  });

  const indexableRows = rows.filter((row) => row.status === 200);
  const expectedCanonical = (route) => `${origin}${route === "/" ? "/" : route}`;
  const tdkIssues = {
    non200: rows.filter((row) => row.status !== 200).map((row) => `${row.route} (${row.status})`),
    missingTitle: indexableRows.filter((row) => !row.title).map((row) => row.route),
    missingDescription: indexableRows.filter((row) => !row.description).map((row) => row.route),
    duplicateTitles: duplicateGroups(indexableRows, "title"),
    duplicateDescriptions: duplicateGroups(indexableRows, "description"),
    wrongCanonical: indexableRows.filter((row) => row.canonicalAbsolute !== expectedCanonical(row.route)).map((row) => ({ route: row.route, canonical: row.canonical })),
    nonIndexFollow: indexableRows.filter((row) => !/(^|[ ,])index([ ,]|$)/i.test(row.robots) || !/(^|[ ,])follow([ ,]|$)/i.test(row.robots)).map((row) => ({ route: row.route, robots: row.robots })),
    wrongLanguage: indexableRows.filter((row) => !/^fr(?:-|$)/i.test(row.lang)).map((row) => ({ route: row.route, lang: row.lang }))
  };

  const allNodes = rows.flatMap((row) => row.jsonLdNodes);
  const allTypes = [...new Set(allNodes.flatMap((node) => node.type))].sort();
  const uniqueSchemaNodes = (type) => {
    const seen = new Set();
    return allNodes.filter((node) => {
      if (!node.type.includes(type)) return false;
      const key = node.id || `${type}:${node.url || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const organizationNodes = uniqueSchemaNodes("Organization");
  const websiteNodes = uniqueSchemaNodes("WebSite");
  const pageSchemaMissing = indexableRows.filter((row) => !row.jsonLdTypes.includes("WebPage") && !row.jsonLdTypes.includes("CollectionPage"));
  const jsonLdIssues = {
    httpOrFetchFailures: rows.filter((row) => row.status !== 200).map((row) => `${row.route} (${row.status})`),
    parseErrors: rows.filter((row) => row.jsonLdParseErrors.length).map((row) => ({ route: row.route, errors: row.jsonLdParseErrors })),
    emptySchema: indexableRows.filter((row) => row.jsonLdBlockCount === 0).map((row) => row.route),
    missingPageSchema: pageSchemaMissing.map((row) => row.route),
    organizationMissingSameAs: organizationNodes.length === 0
      ? ["site-wide Organization"]
      : organizationNodes.filter((node) => !node.sameAs.length || !node.contactPoint).map((node) => node.id || "Organization"),
    websiteMissingFrenchLanguage: websiteNodes.length === 0 ? ["site-wide WebSite"] : websiteNodes.filter((node) => !/^fr(?:-|$)/i.test(String(node.inLanguage))).map((node) => node.id || "WebSite")
  };

  const noindexRoutes = [...retiredRoutes, ...sentinelRoutes, `/route-that-does-not-exist-${Date.now()}`];
  const noindexRows = await mapLimit(noindexRoutes, Math.min(concurrency, 5), async (route) => {
    try {
      const response = await fetchText(`${origin}${route}`, "manual");
      const robotsMeta = meta(response.body, "robots");
      const xRobotsTag = response.headers["x-robots-tag"] || "";
      const hasNoindex = /(^|[ ,;])noindex([ ,;]|$)/i.test(robotsMeta) || /(^|[ ,;])noindex([ ,;]|$)/i.test(xRobotsTag);
      return { route, status: response.status, location: response.headers.location || "", robotsMeta, xRobotsTag, hasNoindex };
    } catch (error) {
      return { route, status: 0, location: "", robotsMeta: "", xRobotsTag: "", hasNoindex: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  const noindexIssues = noindexRows.filter((row) => row.status !== 404 || !row.hasNoindex);

  const result = {
    generatedAt: new Date().toISOString(),
    origin,
    skippedPerformanceChecks: ["Google PageSpeed", "Lighthouse"],
    sitemap: {
      status: sitemap.status,
      urlCount: sitemapUrls.length,
      duplicateLocCount: sitemapLocs.length - sitemapUrls.length,
      hostProblems: sitemapHostProblems,
      routes
    },
    tdk: {
      checked: rows.length,
      passed: Object.values(tdkIssues).every((value) => value.length === 0),
      issues: tdkIssues,
      rows
    },
    jsonLd: {
      checked: rows.length,
      passed: Object.values(jsonLdIssues).every((value) => value.length === 0),
      issues: jsonLdIssues,
      allTypes,
      organizationNodeCount: organizationNodes.length,
      websiteNodeCount: websiteNodes.length
    },
    notFoundNoindex: {
      checked: noindexRows.length,
      passed: noindexIssues.length === 0,
      issues: noindexIssues,
      rows: noindexRows
    }
  };
  result.overallPassed = result.sitemap.status === 200 && result.sitemap.urlCount > 0 && result.tdk.passed && result.jsonLd.passed && result.notFoundNoindex.passed;

  const duplicateTitleText = tdkIssues.duplicateTitles.map((group) => `${group.routes.join(", ")} — “${group.value}”`).join("；");
  const duplicateDescriptionText = tdkIssues.duplicateDescriptions.map((group) => `${group.routes.join(", ")} — “${group.value.slice(0, 100)}${group.value.length > 100 ? "…" : ""}”`).join("；");
  const md = `# Aidreamcapes EU SEO 最终独立验收报告\n\n- 生成时间：${result.generatedAt}\n- 线上地址：[${origin}](${origin})\n- Sitemap：${result.sitemap.urlCount} 个 URL，HTTP ${result.sitemap.status}\n- 明确跳过：Google PageSpeed、Lighthouse\n\n## 总结\n\n${result.overallPassed ? "✅ 三项门禁全部通过。" : "⚠️ 仍有验收项未通过，详见下方问题清单。"}\n\n| 门禁 | 状态 | 检查范围 | 结果 |\n|---|---|---:|---|\n| 全量 TDK 唯一性 | ${result.tdk.passed ? "PASS" : "FAIL"} | ${result.tdk.checked} 个 sitemap 页面 | 标题/描述非空、唯一、canonical、自身 index/follow、法语 lang |\n| JSON-LD 独立解析 | ${result.jsonLd.passed ? "PASS" : "FAIL"} | ${result.jsonLd.checked} 个 sitemap 页面 | JSON 可解析、页面 Schema、Organization/WebSite |\n| 404 + noindex | ${result.notFoundNoindex.passed ? "PASS" : "FAIL"} | ${result.notFoundNoindex.checked} 个失效/哨兵 URL | HTTP 404 且响应头或 meta robots 含 noindex |\n\n## 1. TDK 唯一性\n\n- 非 200：${tdkIssues.non200.length}\n- 缺失 title：${tdkIssues.missingTitle.length}\n- 缺失 description：${tdkIssues.missingDescription.length}\n- 重复 title 组：${tdkIssues.duplicateTitles.length}\n- 重复 description 组：${tdkIssues.duplicateDescriptions.length}\n- canonical 错误：${tdkIssues.wrongCanonical.length}\n- 非 index/follow：${tdkIssues.nonIndexFollow.length}\n- 非法语 html lang：${tdkIssues.wrongLanguage.length}\n\n### 重复 Title\n\n${mdList(duplicateTitleText ? [duplicateTitleText] : [])}\n\n### 重复 Description\n\n${mdList(duplicateDescriptionText ? [duplicateDescriptionText] : [])}\n\n## 2. JSON-LD 独立解析\n\n- 所有 JSON-LD 解析错误：${jsonLdIssues.parseErrors.length}\n- 无 JSON-LD 页面：${jsonLdIssues.emptySchema.length}\n- 缺少 WebPage/CollectionPage：${jsonLdIssues.missingPageSchema.length}\n- Organization 节点：${organizationNodes.length}\n- WebSite 节点：${websiteNodes.length}\n- 全站发现的类型：${allTypes.join(", ") || "无"}\n\n### JSON-LD 问题\n\n${mdList([
    ...jsonLdIssues.parseErrors.map((item) => `${item.route}: ${item.errors.join(" | ")}`),
    ...jsonLdIssues.emptySchema.map((route) => `${route}: 没有 JSON-LD`),
    ...jsonLdIssues.missingPageSchema.map((route) => `${route}: 缺少 WebPage/CollectionPage`),
    ...jsonLdIssues.organizationMissingSameAs.map((item) => `${item}: 缺少可验证 sameAs/id`),
    ...jsonLdIssues.websiteMissingFrenchLanguage.map((item) => `${item}: 缺少法语 inLanguage`)
  ])}\n\n## 3. 404 + noindex\n\n${noindexRows.map((row) => `- ${row.route}: HTTP ${row.status}；meta robots=\`${row.robotsMeta || ""}\`；X-Robots-Tag=\`${row.xRobotsTag || ""}\`；noindex=${row.hasNoindex ? "是" : "否"}`).join("\n")}\n\n## 原始数据\n\n完整逐页结果请查看同名 JSON 报告。\n`;

  await fs.writeFile(`${reportBase}.json`, `${JSON.stringify(result, null, 2)}\n`);
  await fs.writeFile(`${reportBase}.md`, md);
  console.log(JSON.stringify({
    overallPassed: result.overallPassed,
    sitemapCount: result.sitemap.urlCount,
    tdk: { passed: result.tdk.passed, checked: result.tdk.checked, issueCount: Object.values(tdkIssues).reduce((sum, value) => sum + value.length, 0) },
    jsonLd: { passed: result.jsonLd.passed, checked: result.jsonLd.checked, issueCount: Object.values(jsonLdIssues).reduce((sum, value) => sum + value.length, 0), allTypes },
    notFoundNoindex: { passed: result.notFoundNoindex.passed, checked: result.notFoundNoindex.checked, issueCount: noindexIssues.length },
    reports: [`${reportBase}.md`, `${reportBase}.json`]
  }, null, 2));
  if (!result.overallPassed) process.exitCode = 1;
}

await main();
