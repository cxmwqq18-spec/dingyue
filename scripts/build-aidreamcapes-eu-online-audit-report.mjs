#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const templatePath = "/Users/a1/.codex/skills/seo-audit-full/assets/report-template.html";
const smokePath = process.env.SMOKE_REPORT || "reports/aidreamcapes-eu-full-site-smoke-2026-09-16T14-29-16-545Z.json";
const outputPath = process.env.AUDIT_HTML || "reports/aidreamcapes-eu-full-audit.html";
const smoke = JSON.parse(await fs.readFile(path.resolve(root, smokePath), "utf8"));
const template = await fs.readFile(templatePath, "utf8");
const pages = smoke.pages;
const okPages = pages.filter((page) => page.status === 200);
const indexablePages = pages.filter((page) => page.expectedIndexable);
const failedPages = pages.filter((page) => page.status !== 200);
const brokenImageOccurrences = pages.reduce((sum, page) => sum + page.badImageResponses.length, 0);
const uniqueBrokenImages = new Set(pages.flatMap((page) => page.badImageResponses.map((item) => item.url.split("?")[0])));
const consoleErrorPages = pages.filter((page) => page.consoleErrors.length > 0).length;
const imageFailurePages = pages.filter((page) => page.badImageResponses.length > 0).length;
const titleLong = okPages.filter((page) => page.titleLength > 60).length;
const descriptionOutOfRange = okPages.filter((page) => page.descriptionLength < 120 || page.descriptionLength > 160).length;
const mixedCopyPages = pages.filter((page) => page.failures.includes("english-copy")).length;
const canonicalIssues = pages.filter((page) => page.failures.includes("canonical")).map((page) => page.route);
const routeFailures = pages.filter((page) => page.failures.some((failure) => /^(?:http-|navigation-error|no-http-response)/.test(failure)));
const robotsIssues = pages.filter((page) => page.failures.includes("robots-meta"));
const ogTypePages = okPages.filter((page) => page.ogType === "website").length;
const faqSchemaPages = pages.filter((page) => page.hasFaqSchema).length;
const webpageSchemaPages = pages.filter((page) => page.hasWebPage).length;
const breadcrumbPages = pages.filter((page) => page.hasBreadcrumbList).length;
const imageDomProblems = pages.filter((page) => page.imageProblems.length > 0).length;
const duplicateRefs = pages.reduce((sum, page) => sum + page.duplicateImageUrls.length, 0);
const sitemapCandidateCount = pages.filter((page) => page.source === "sitemap").length;
const internalCandidateCount = pages.filter((page) => page.source === "internal").length;

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function badge(status, label = status) {
  return `<span class="status status-${status}">${esc(label)}</span>`;
}

function issue(detail, fix) {
  return `<div class="detail-issue">· ${esc(detail)}</div><div class="detail-fix">${esc(fix)}</div>`;
}

function pageStatus(page) {
  if (page.status !== 200 || page.failures.some((failure) => /^(?:navigation-error|no-http-response|http-)/.test(failure))) return "fail";
  if (page.failures.length) return "warn";
  return "pass";
}

function pageResult(page) {
  const status = pageStatus(page);
  if (status === "pass") return badge("pass", "Pass");
  const labels = [...new Set(page.failures)].join(", ") || (page.status ? `HTTP ${page.status}` : "no response");
  return `${badge(status, status === "fail" ? "Fail" : "Warning")}<br><small>${esc(labels)}</small>`;
}

function pageRow(page) {
  const canonical = page.canonical || "—";
  const robots = page.robots || "—";
  const og = page.ogType || "missing";
  return `<tr>
    <td><code>${esc(page.route)}</code></td>
    <td>${page.status || "—"}</td>
    <td>${page.titleLength || 0}</td>
    <td>${page.descriptionLength || 0}</td>
    <td>${page.h1} / ${esc(page.lang || "—")}</td>
    <td class="wrap">${esc(canonical)}</td>
    <td class="wrap">${esc(robots)}</td>
    <td>${esc(og)}</td>
    <td>${page.imageCount}<br><small>${page.badImageResponses.length ? `${page.badImageResponses.length} image 404` : "no image 4xx"}</small></td>
    <td>${pageResult(page)}</td>
  </tr>`;
}

const titleTooLongExamples = okPages.filter((page) => page.titleLength > 60).slice(0, 8).map((page) => `${page.route} (${page.titleLength})`).join("；");
const mixedCopyExamples = pages.filter((page) => page.failures.includes("english-copy")).slice(0, 10).map((page) => page.route).join("、");
const pageTable = `<div class="subsection-label">HTTP / TDK / 页面元素逐页结果</div>
<p class="inventory-note">本表覆盖本轮线上巡检的 ${pages.length} 个唯一路由：66 个 sitemap 候选页和 36 个内链/内部候选页。PageSpeed、Search Console、真实 Google 收录状态按用户要求跳过。</p>
<div class="table-scroll"><table class="check-table page-audit-table"><thead><tr><th>Route</th><th>HTTP</th><th>Title</th><th>Description</th><th>H1 / lang</th><th>Canonical</th><th>Robots</th><th>OG type</th><th>Images</th><th>Result</th></tr></thead><tbody>${pages.map(pageRow).join("")}</tbody></table></div>`;

const summaryVerdict = `线上站点可访问性部分通过，但当前不具备稳定 SEO 上线条件：${okPages.length}/${pages.length} 个巡检路由返回 200，sitemap 返回 200 但包含 0 个 URL，浏览器发现 ${uniqueBrokenImages.size} 个不同图片 URL 返回 404，且公网域名与最新候选运行时的绑定仍需修正。`;

const criticalHtml = [
  "sitemap.xml HTTP 200 但空 urlset，当前 66 个 sitemap 候选页和 12 个 Save the Date 详情页均未被列出",
  `图片交付失败：${imageFailurePages} 页、${brokenImageOccurrences} 次图片 404，${uniqueBrokenImages.size} 个不同图片 URL无法从公网读取`,
  "公网 aidreamcapes.eu 未发现独立 Nginx vhost，线上 HTML/静态资源未能证明来自最新 3010 release",
  "/ai-save-the-date/wedding-invitation 的 canonical 错指向 /ai-video-generation/wedding-invitation",
  "/ai-image-generation/estilo-y-fantasia 返回 404，属于仍被巡检发现的脏/失效路由候选"
].map((item) => `<li>${esc(item)}</li>`).join("");

const warningsHtml = [
  `${titleLong} 个页面 Title 超过 60 字符（示例：${titleTooLongExamples}）`,
  `${descriptionOutOfRange} 个页面 Description 不在 120–160 字符目标区间`,
  `${okPages.length - ogTypePages} 个 HTTP 200 页面缺少或错误配置 og:type=website；当前通过页为 ${ogTypePages}/${okPages.length}`,
  `JSON-LD 缺少页面级 WebPage/FAQPage：可见 FAQ 页 ${pages.filter((page) => page.visibleFaqCount > 0).length} 个，但 FAQPage 为 ${faqSchemaPages} 个`,
  `${mixedCopyPages} 个页面仍检测到英语文案残留，代表性路由：${mixedCopyExamples}`,
  `${robotsIssues.length} 个内部候选页为 noindex 或缺少 index,follow 组合，需确认是否真的应公开索引`,
  "当前审计路由清单为 102 个；既有整改方案写作 103 个，数量差额应在正式 sitemap 规则中明确归类"
].map((item) => `<li>${esc(item)}</li>`).join("");

const passingHtml = [
  `${okPages.length}/${pages.length} 个巡检路由返回 HTTP 200；12 个 Save the Date 主题详情页均为 200`,
  `${okPages.filter((page) => page.h1 === 1).length}/${okPages.length} 个 200 页面恰好 1 个 H1`,
  `${okPages.filter((page) => page.lang === "fr").length}/${okPages.length} 个 200 页面使用 html lang="fr"`,
  `${okPages.filter((page) => page.canonical.startsWith("https://aidreamcapes.eu/")).length}/${okPages.length} 个 200 页面 canonical 使用 HTTPS 正式域名`,
  `DOM 图片 alt 缺失/空值问题为 ${imageDomProblems} 页；浏览器共检查 ${okPages.reduce((sum, page) => sum + page.imageCount, 0)} 个 img`,
  "移动端横向溢出为 0 页",
  "robots.txt 返回 200、Allow: /，并声明 Sitemap: https://aidreamcapes.eu/sitemap.xml",
  "已确认废弃的 /ai-save-the-date/easter 返回 404"
].map((item) => `<li>${esc(item)}</li>`).join("");

const pagespeedHtml = `<div class="pagespeed-overview"><div class="pagespeed-panel"><div class="pagespeed-head"><div class="pagespeed-title">PageSpeed / Google checks</div>${badge("warn", "Skipped")}</div><p>按用户要求跳过 PageSpeed Insights、Search Console、URL Inspection 和真实 Google 收录检查。本报告不填充或推测 Lighthouse、Core Web Vitals、索引覆盖等分数。</p></div><div class="pagespeed-panel"><div class="pagespeed-head"><div class="pagespeed-title">可替代的线上证据</div>${badge("pass", "Captured")}</div><ul><li>浏览器桌面/移动巡检：${pages.length} 个路由</li><li>HTTP、TDK、H1、canonical、robots、JSON-LD、图片请求、控制台和移动溢出均已采集</li><li>报告时间：${esc(smoke.run || smoke.generatedAt || "2026-09-16T14:29:16.543Z")}</li></ul></div></div>`;

const siteChecksHtml = `<div class="subsection-label">Sitemap URL Inventory</div>
<table class="check-table"><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>
<tr><td>Sitemap URL inventory</td><td>${badge("fail", "Fail")}</td><td>${issue("HTTP 200 但 XML urlset 中 loc 数量为 0。robots 已声明 sitemap，但 Google 无法从中发现页面。", "恢复正式站 sitemap 生成逻辑；输出所有当前 canonical、可索引公开路由，并自动校验 HTTP、canonical、robots 和重复 URL。")}</td></tr>
<tr><td>Expected page coverage</td><td>${badge("fail", "Fail")}</td><td>${issue(`本轮清单包含 ${pages.length} 个路由，其中 ${sitemapCandidateCount} 个 sitemap 候选和 ${internalCandidateCount} 个内链/内部候选；线上 sitemap 实际覆盖 0 个。`, "以数据库的公开页面归类生成 sitemap，不要只用是否存在页面记录作为入选条件。")}</td></tr>
<tr><td>robots.txt</td><td>${badge("pass", "Pass")}</td><td>User-agent * Allow /；Sitemap 指令存在；线上响应 200。</td></tr>
<tr><td>404 handling</td><td>${badge("pass", "Pass")}</td><td>已废弃 Easter 路由返回 404；失效 estilo-y-fantasia 也返回 404，但应从可公开内链中移除或建立明确替代。</td></tr>
<tr><td>Public image delivery</td><td>${badge("fail", "Fail")}</td><td>${issue(`${imageFailurePages} 个页面出现图片 404，合计 ${brokenImageOccurrences} 次，涉及 ${uniqueBrokenImages.size} 个不同 URL；页面 DOM 有 alt 不代表资源实际可抓取。`, "让 aidreamcapes.eu 的静态资源路径指向包含这些资源的最新 release/CDN；修复后重新逐图 GET 校验真实状态、Content-Type 和像素尺寸。")}</td></tr>
<tr><td>Runtime / edge binding</td><td>${badge("fail", "Fail")}</td><td>${issue("公网未发现 aidreamcapes.eu 独立 Nginx server_name；已部署候选服务为 3010，但现有域名配置证据显示请求仍可能命中旧运行时。", "为 aidreamcapes.eu 建立独立 vhost/Cloudflare origin route，指向正确服务和 assets 根目录；切换后用正式域名回读 release marker、HTML、sitemap 与图片。")}</td></tr>
<tr><td>URL canonicalization</td><td>${badge("warn", "Warning")}</td><td>${issue("/ai-save-the-date/wedding-invitation 200，但 canonical 指向 /ai-video-generation/wedding-invitation；/ai-image-generation/estilo-y-fantasia 为 404。", "为每个可索引页面输出自指 canonical；对废弃/重复路由选择 404 或 301 到唯一替代页，且不要进入 sitemap。")}</td></tr>
<tr><td>i18n / hreflang</td><td>${badge("na", "N/A")}</td><td>当前为单一法语公开版本；未发现可验证的其他语言版本，不应虚构 hreflang。</td></tr>
<tr><td>Schema JSON-LD</td><td>${badge("fail", "Fail")}</td><td>${issue(`页面级 WebPage 为 ${webpageSchemaPages}/${pages.length}，FAQPage 为 ${faqSchemaPages}/${pages.length}，BreadcrumbList 页面覆盖为 ${breadcrumbPages}/${pages.length}；可见 FAQ 与结构化 FAQ 不成对。`, "按页面实际可见内容生成 WebPage、BreadcrumbList 和 FAQPage；设置 inLanguage=fr-FR，并让 FAQ 数据源与可见 FAQ 共用。")}</td></tr>
</tbody></table>
<div class="subsection-label">Online data / SQL read path</div>
<table class="check-table"><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>
<tr><td>Application data source</td><td>${badge("pass", "Code pass")}</td><td>本地代码的公开 SSR 入口通过 Prisma RepeatableRead 事务读取 Site、LivePage.contentJson、ThemeSettings、MediaAsset、VideoTheme 等关系数据；local JSON fallback 已禁用。</td></tr>
<tr><td>Online readback certainty</td><td>${badge("warn", "Warning")}</td><td>由于公网域名仍存在 edge/runtime 绑定疑点，本轮不能仅凭公网 HTML 证明它已经命中最新 3010 release；需要修复路由后重新做 release marker 与 SQL 数据回读。</td></tr>
</tbody></table>`;

const eeatHtml = `<div class="subsection-label">E-E-A-T Trust Pages</div><table class="check-table"><thead><tr><th>E-E-A-T Page</th><th>Exists</th><th>Reachable</th><th>Detail</th></tr></thead><tbody>
<tr><td>About Us</td><td>${badge("pass", "200")}</td><td>${badge("pass", "In scope")}</td><td>/about-us 返回 200；需上线后确认 footer 可见链接。</td></tr>
<tr><td>Contact</td><td>${badge("pass", "200")}</td><td>${badge("pass", "In scope")}</td><td>/contact-us 返回 200。</td></tr>
<tr><td>Privacy / Terms</td><td>${badge("pass", "200")}</td><td>${badge("pass", "In scope")}</td><td>/privacy、/terms、/cookies 等政策页均在公开巡检范围内并返回 200。</td></tr>
<tr><td>Pricing</td><td>${badge("pass", "200")}</td><td>${badge("pass", "In scope")}</td><td>/pricing 返回 200，具备转化前的价格信息入口。</td></tr>
</tbody></table>`;

const pageChecksHtml = `${pageTable}
<div class="subsection-label">Aggregate page findings</div><table class="check-table"><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>
<tr><td>HTTP response</td><td>${badge(failedPages.length ? "fail" : "pass", failedPages.length ? "Fail" : "Pass")}</td><td>${failedPages.length ? issue(`${failedPages.length} 个路由未得到正常 200：${failedPages.map((page) => `${page.route} (${page.status || "no response"})`).join("；")}`, "清理失效公开链接、修复认证页重定向循环，并让公开页面连续冷启动返回 200。") : "所有路由返回 200。"}</td></tr>
<tr><td>Title / meta description</td><td>${badge(titleLong || descriptionOutOfRange ? "warn" : "pass", titleLong || descriptionOutOfRange ? "Warning" : "Pass")}</td><td>${issue(`${titleLong} 个 Title 超过 60 字符；${descriptionOutOfRange} 个 Description 不在 120–160 字符目标区间。12 个 Save the Date 页的 TDK 长度均在目标区间内。`, "优先把英文 image category 和 private album 标题改成自然法语，并缩短超长 Title；保留每页独立搜索意图。")}</td></tr>
<tr><td>H1 / lang</td><td>${badge(okPages.every((page) => page.h1 === 1 && page.lang === "fr") ? "pass" : "warn", okPages.every((page) => page.h1 === 1 && page.lang === "fr") ? "Pass" : "Warning")}</td><td>${okPages.filter((page) => page.h1 === 1 && page.lang === "fr").length}/${okPages.length} 个 200 页面符合 1 H1 + lang=fr。</td></tr>
<tr><td>Image alt</td><td>${badge(imageDomProblems ? "warn" : "pass", imageDomProblems ? "Warning" : "Pass")}</td><td>${imageDomProblems ? issue(`${imageDomProblems} 页存在 DOM alt 问题。`, "为内容图片补齐准确、简洁的法语 alt；装饰图使用空 alt + aria-hidden。") : "浏览器 DOM 检查未发现内容图片 missing/empty alt；但真实图片请求仍大量 404，alt 通过不等于图片 SEO 完整通过。"}</td></tr>
<tr><td>Image uniqueness</td><td>${badge("warn", "Needs revalidation")}</td><td>${issue(`浏览器线上无法对返回 404 的资源认证真实像素、SHA-256 或感知哈希；当前仅发现页面内共享 URL 引用 ${duplicateRefs} 次。`, "先恢复图片可访问性，再执行 Sharp 3840×2160 JPEG、SHA-256 和感知哈希审计；不要把通用 header/review 复用误判为主题资产重复。")}</td></tr>
<tr><td>Copy language</td><td>${badge(mixedCopyPages ? "warn" : "pass", mixedCopyPages ? "Warning" : "Pass")}</td><td>${mixedCopyPages ? issue(`${mixedCopyPages} 个页面的可见文案仍包含英语残留，主要集中在 AI image/video 详情与私有相册页。`, "逐页将正文、H2/H3、FAQ、CTA 和图片说明统一为法语；主题专有名词可保留，但句子语法必须完整。") : "未发现语言残留。"}</td></tr>
<tr><td>Console / image network</td><td>${badge(consoleErrorPages ? "fail" : "pass", consoleErrorPages ? "Fail" : "Pass")}</td><td>${issue(`${consoleErrorPages} 页有控制台错误；核心重复模式是图片 404，另有 /app/create 和 /login 的重定向循环。`, "修复资源 origin/vhost、确认媒体路径和认证路由；修复后重新跑桌面、移动和滚动加载巡检。")}</td></tr>
</tbody></table>`;

const priorityHtml = `<ol class="priority-list">
<li>立即修复正式域名的 vhost/Cloudflare 到 3010 release 的绑定，确保 HTML 与 /assets 使用同一线上版本。</li>
<li>恢复非空 sitemap.xml：纳入所有当前 canonical、可索引公开页面，至少覆盖现有 66 个 sitemap 候选，并在生成流程中加入 loc/HTTP/canonical/robots 自动校验。</li>
<li>修复图片静态资源 404；对 12 个 Save the Date 主题和全站实际引用资源逐图验证 200、Content-Type、解码和真实 3840×2160 JPEG。</li>
<li>修正 wedding-invitation canonical、清理 estilo-y-fantasia 等脏路由及认证页重定向循环。</li>
<li>补齐页面级 WebPage、BreadcrumbList、FAQPage JSON-LD，统一 inLanguage=fr-FR，并让 FAQ schema 与可见 FAQ 共用数据。</li>
<li>优先整改 27 个英语/法语混用页面及 38 个超长 Title；保证每个可索引页面的法语正文、TDK、H1、图片 alt 与搜索意图一致。</li>
</ol>`;

const insightsHtml = `<article class="finding"><div class="finding-header">${badge("fail", "Critical")}<h3>Sitemap 是硬阻断项</h3></div><div class="finding-body"><div class="finding-field"><span class="label">Evidence</span><span class="value">${esc("https://aidreamcapes.eu/sitemap.xml 返回 200，但内容只有空 urlset，loc 数量为 0。")}</span></div><div class="finding-field"><span class="label">Impact</span><span class="value">Google 即使允许抓取，也无法通过 sitemap 发现当前详情页；12 个 Save the Date 页面不会被 sitemap 主动提交。</span></div><div class="finding-field"><span class="label">Fix</span><span class="value">修复 sitemap 生成和线上运行时绑定，加入自动化 coverage、canonical、status 和 noindex 校验。</span></div></div></article>
<article class="finding"><div class="finding-header">${badge("fail", "Critical")}<h3>图片在公网不可抓取</h3></div><div class="finding-body"><div class="finding-field"><span class="label">Evidence</span><span class="value">浏览器巡检 102 个路由时，89 页出现图片 404，共 1,018 次失败响应，去参数后有 828 个不同坏图 URL。</span></div><div class="finding-field"><span class="label">Impact</span><span class="value">页面虽然存在 img 和 alt，但用户、Googlebot 和图片搜索都拿不到图像；同时会产生大量控制台错误。</span></div><div class="finding-field"><span class="label">Fix</span><span class="value">把正式域名静态资源请求接到实际发布资源；修复后再做真实像素与去重验收。线上 404 期间不能宣称已完成 4K 图片 SEO。</span></div></div></article>
<article class="finding"><div class="finding-header">${badge("warn", "Warning")}<h3>12 个 Save the Date 页面的局部结论</h3></div><div class="finding-body"><div class="finding-field"><span class="label">Evidence</span><span class="value">12/12 页面 HTTP 200、各 1 个 H1、lang=fr、Title 和 Description 独立且长度合适；11/12 canonical 自指，wedding-invitation 错指；12/12 都缺 og:type=website 和 FAQPage/WebPage 页面级 JSON-LD；每页均有图片 404。</span></div><div class="finding-field"><span class="label">Impact</span><span class="value">主题文案基础较好，但 canonical、社交摘要、结构化数据和图片可抓取性仍会削弱详情页的搜索展示。</span></div><div class="finding-field"><span class="label">Fix</span><span class="value">先修 edge/assets，再重跑 12 页专用 smoke；同时修正 canonical、OG type、JSON-LD 和可见 FAQ 一致性。</span></div></div></article>
<article class="finding"><div class="finding-header">${badge("pass", "Pass")}<h3>数据库实时读取能力与公网命中版本需分开验证</h3></div><div class="finding-body"><div class="finding-field"><span class="label">Evidence</span><span class="value">代码层的公开 SSR 通过 Prisma RepeatableRead 事务读取当前 PostgreSQL 的 LivePage.contentJson、ThemeSettings、MediaAsset 和主题关系数据；local JSON fallback 已禁用，公开缓存 TTL 默认 0（只保留并发去重）。</span></div><div class="finding-field"><span class="label">Impact</span><span class="value">代码设计支持实时 SQL 读取，但公网域名当前缺少独立 aidreamcapes.eu vhost 证据，线上页面可能来自旧 runtime，因此不能把代码结论直接等同于线上 readback 结论。</span></div><div class="finding-field"><span class="label">Fix</span><span class="value">修复域名路由后，用正式域名回读 release marker、版本 HTML、sitemap、图片和一条数据库刚更新的公开字段，完成端到端验证。</span></div></div></article>`;

const replacements = {
  "{{report_title}}": "Aidreamcapes EU — Online Full SEO Audit",
  "{{url}}": "https://aidreamcapes.eu/",
  "{{audit_level}}": "Full online audit (PageSpeed skipped)",
  "{{generated_date}}": new Date(smoke.generatedAt || Date.now()).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
  "{{summary_verdict}}": esc(summaryVerdict),
  "{{summary_critical_html}}": criticalHtml,
  "{{summary_warnings_html}}": warningsHtml,
  "{{summary_passing_html}}": passingHtml,
  "{{pagespeed_checks_html}}": pagespeedHtml,
  "{{site_checks_html}}": siteChecksHtml,
  "{{eeat_checks_html}}": eeatHtml,
  "{{page_checks_html}}": pageChecksHtml,
  "{{priority_actions_html}}": priorityHtml,
  "{{insights_html}}": insightsHtml
};
let output = template;
for (const [token, value] of Object.entries(replacements)) output = output.replaceAll(token, value);
await fs.writeFile(path.resolve(root, outputPath), output, "utf8");
console.log(JSON.stringify({ output: path.resolve(root, outputPath), pages: pages.length, http200: okPages.length, brokenImageUrls: uniqueBrokenImages.size, brokenImageOccurrences, titleLong, descriptionOutOfRange, mixedCopyPages }, null, 2));
