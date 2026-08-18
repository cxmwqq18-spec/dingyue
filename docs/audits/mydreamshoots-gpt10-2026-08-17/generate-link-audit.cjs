/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const evidence = require(path.join(__dirname, "link-evidence.json"));

const specialAssessments = new Map([
  ["https://www.mydreamshoots.com/", "PASS：品牌首页锚文本可识别，200 直达。"],
  ["https://www.mydreamshoots.com/ai-image-generation/photo-enhancer", "P0：Header 的 Photo Enhancer 正确；URL 3 Hero 却写 Open Magic Upscaler，产品实体不一致。目标页无 H1。"],
  ["https://www.mydreamshoots.com/ai-image-generation/travel", "P0：Header 的 Travel 正确；URL 4 Hero 写 Open Nature theme，未解释 Nature 是 Travel 方向。目标页无 H1。"],
  ["https://www.mydreamshoots.com/ai-image-generation/urban", "P0：Header 的 Urban 正确；URL 5 Hero 写 Open Outdoor Creator Scenes theme，但目标只覆盖 Urban，未覆盖 Hero 的海岸/悬崖。目标页无 H1。"],
  ["https://www.mydreamshoots.com/app/create", "P1：未登录会到 /login?next=/app/create（200、noindex）。Text to video / Image to Video 的 #step-video 留在登录页 fragment，next 参数未保留该步骤；登录后的落点无法从公开访问确认。"],
  ["https://www.mydreamshoots.com/blog/ai-video-add-ons-photo-package-guide", "P1：200，但 9 个主题页全部使用同一 Open AI Video Add-ons theme；与大多数页面关系弱，且目标自身是同类模板文。应按主题选择相关文章。"],
  ["https://www.mydreamshoots.com/blog/anime-avatar-photo-package-guide", "P1：200；URL 暗示 Anime Avatar，Title/H1 只写 Avatar，锚文本也过泛；与 Profile Cards 目标近重复。"],
  ["https://www.mydreamshoots.com/blog/profile-cards-photo-package-guide", "P0：200 但 Title/H1 均为 Avatar，正文仍是 Avatar 模板；锚文本 Open Avatar theme 不能描述 Profile Cards。应独立重写或 301 合并，不能保持两个 self-canonical 近重复页。"],
  ["https://www.mydreamshoots.com/ai-video-generation", "P0：锚文本和 Title 是 AI Video Generation，但 H1 是 Paid AI photo tools for better source images，首屏实体/意图错误；页脚还加了内部 nofollow。"],
  ["https://www.instagram.com/blydey_inc", "P1：200，平台正确；目的品牌是 BLYDEY INC，不是 myDreamshoots。外链 nofollow/noopener/noreferrer 合理，但需公开解释品牌关系或更换账号。"],
  ["https://www.facebook.com/blydeyinc", "P1：200，平台正确；目的品牌是 Blydeyus INC，不是 myDreamshoots。需解释关系或更换账号。"],
  ["https://www.threads.com/@blydey_inc", "P1：200，平台正确；目的品牌是 BLYDEY INC，不是 myDreamshoots。需解释关系或更换账号。"],
  ["https://www.pinterest.com/Blydeyinc", "P1：200，规范化补 /；目的品牌是 BLYDEYUS，不是 myDreamshoots。需解释关系或更换账号。"],
  ["https://www.youtube.com/@blydey-inc", "P1：200；目的频道名 blydey 且当前公开页面显示无内容，不足以支持 YouTube for myDreamshoots。需解释关系、更新频道或移除。"],
]);

const internalFooterNofollow = new Set([
  "/ai-image-generation",
  "/best-packages",
  "/workflow",
  "/blog",
  "/pricing",
  "/ai-video-generation",
  "/about-us",
  "/contact-us",
  "/creators-circle",
  "/refunds",
  "/privacy",
  "/content",
  "/terms",
  "/cookies",
  "/children-privacy",
  "/state-privacy",
]);

function displayTarget(target) {
  const url = new URL(target.targetUrl);
  if (url.hostname === "www.mydreamshoots.com") {
    const label = `${url.pathname}${url.search}` || "/";
    return `[${label}](${target.targetUrl})`;
  }
  return `[${url.hostname}${url.pathname}](${target.targetUrl})`;
}

function pagesLabel(occurrences) {
  const pages = [...new Set(occurrences.map((occurrence) => occurrence.page))];
  return pages.length === 9 ? "1-9" : pages.join(", ");
}

function assessment(target) {
  if (specialAssessments.has(target.targetUrl)) return specialAssessments.get(target.targetUrl);
  const url = new URL(target.targetUrl);
  if (url.hostname === "www.mydreamshoots.com" && /^\/ai-image-generation\/.+/.test(url.pathname)) {
    return "P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。";
  }
  if (/\/blog\/(?:cyberpunk|mafia|magic-upscaler|nature|outdoor-creator-scenes|valentine-photos|virtual-try-on|wedding-portraits|world-cup-fan-photos)-photo-package-guide/.test(url.pathname)) {
    return "PASS（链接层）：本页 8 个目录 fragment 均命中；内容质量问题见对应逐页审计。";
  }
  if (url.hostname === "www.mydreamshoots.com" && internalFooterNofollow.has(url.pathname)) {
    return "P1：200 且锚文本/目标基本一致；Footer 对站内正常导航使用 nofollow 不合理，应移除（外部社交链接可保留 nofollow）。";
  }
  return "PASS：200 直达，锚文本与目标语义一致。";
}

const lines = [];
lines.push("# GPT10 全链接深度审计");
lines.push("");
lines.push(`检查时间：${evidence.checkedAt}（原始 UTC；报告解释以 Asia/Shanghai 审计日为准）  `);
lines.push("范围：9 个页面 DOM 中全部 1,179 个 `a[href]` 出现记录；73 个去除 fragment 后的 HTTP(S) 网络目标；72 个同页 fragment；1 个跨页 fragment；9 次同一 mailto。所有折叠菜单链接也纳入，因为用户展开菜单后可访问。");
lines.push("");
lines.push("## 结论");
lines.push("");
lines.push("- 73/73 个去重 HTTP(S) 目标在审计时返回 200；无 4xx/5xx、TLS 错误或超时。72/72 个目录锚点 ID 存在；mailto 语法有效。状态正常不代表链接语义正常。");
lines.push("- P0 语义错链：Magic Upscaler → Photo Enhancer、Nature → Travel、Outdoor Creator Scenes → Urban；均可达但实体不一致。");
lines.push("- P0 目的页问题：Profile Cards URL 的 Title/H1/主体仍是 Avatar；AI Video Generation 目标页的 H1 是 Paid AI photo tools。");
lines.push("- P1 全局结构：38 个 `/ai-image-generation/*` package 目标页全部无 H1；16 个站内 Footer 目标被加 `nofollow`。");
lines.push("- P1 登录路径：`/app/create#step-video` 在未登录时到 login，fragment 留在登录页但 `next` 仅为 `/app/create`；登录后的 video step 无法公开确认。");
lines.push("- P1 Trust：5 个社交锚文本声称 for myDreamshoots，落地品牌却是 BLYDEY/BLYDEYUS；About/Contact 没有解释两者关系。");
lines.push("- P0 事实口径：About 的 `100% money-back guarantee / If the shoot doesn't look like you, refund.` 比 Refund Policy 更绝对；后者要求 review，且补救可能是 refund、credit return 或 rerun。About 建议改为：`If a completed shoot does not resemble you, submit the affected job for review under our Refund Policy. Eligible requests may receive a refund, returned credits, or a rerun.`");
lines.push("");
lines.push("## 全部网络目标");
lines.push("");
lines.push("| # | 目标 | 出现页 / 区域 | 锚文本 | 次数 | HTTP / 最终结果 | 评估 |");
lines.push("|---:|---|---|---|---:|---|---|");

for (const [index, target] of evidence.targets.entries()) {
  const regions = [...new Set(target.occurrences.map((occurrence) => occurrence.region))].join("+");
  const texts = [...new Set(target.occurrences.map((occurrence) => occurrence.text))]
    .map((text) => text.replace(/\|/g, "\\|").replace(/\n/g, " "))
    .join(" / ");
  const result = target.redirected
    ? `${target.http.status} → ${target.finalUrl.replace(/\|/g, "\\|")}`
    : `${target.http.status} direct`;
  lines.push(`| ${index + 1} | ${displayTarget(target)} | ${pagesLabel(target.occurrences)} / ${regions} | ${texts} | ${target.occurrences.length} | ${result} | ${assessment(target)} |`);
}

lines.push("");
lines.push("## 72 个目录锚点");
lines.push("");
lines.push("| # | 页 | 锚文本 | 精确目标 | ID 存在 |");
lines.push("|---:|---:|---|---|---|");
for (const [index, hash] of evidence.hashes.entries()) {
  lines.push(`| ${index + 1} | ${hash.page} | ${hash.text.replace(/\|/g, "\\|")} | ${hash.href} | ${hash.targetExists ? "PASS" : "FAIL"} |`);
}

lines.push("");
lines.push("## 其他协议与 fragment");
lines.push("");
lines.push("- `mailto:support@mydreamshoots.com`：9 页各 1 次，语法有效；未发送测试邮件，因此邮箱投递能力无法从本次公开访问确认。");
lines.push("- `https://www.mydreamshoots.com/app/create#step-video`：9 页各有 Text to video 与 Image to Video，共 18 次。未登录最终为 `https://www.mydreamshoots.com/login?next=%2Fapp%2Fcreate#step-video`；`next` 丢失 step 信息。建议使用能被登录回跳完整保留的 query/route 状态，并以登录 E2E 测试验证。");
lines.push("");
lines.push("## 链接层整改顺序");
lines.push("");
lines.push("1. 先修 3 条 Hero 实体错链及 Profile Cards/AI Video 两个目的页错误。既要改锚文本，也要改实体、Title/H1、canonical/redirect 策略，不能只做表面文字替换。");
lines.push("2. 删除正常站内 Footer 导航的 `nofollow`；保留外部社交的 `nofollow noopener noreferrer`。");
lines.push("3. 给 38 个 package 目标页的可见主标题使用 H1，后续分区继续使用 H2/H3。不是追求‘恰好一个 H1’的机械规则，而是修复当前主标题从 H2 开始的语义层级。");
lines.push("4. 用每页真正相邻的产品/指南替换统一的 Headshot + AI Video Add-ons + 两条 Avatar 推荐；锚文本写目的页准确标题。");
lines.push("5. 披露真实运营主体与 BLYDEY/BLYDEYUS 社交账号的关系；若无关系或账号不再代表产品，则更换/移除链接。");
lines.push("6. 让 About、Refund、Privacy、Terms 的承诺从同一政策数据源/组件渲染；后台训练、删除、加密执行仍需内部证据与供应商核验，公开页面本身不能证明。");

fs.writeFileSync(path.join(__dirname, "GPT10-link-audit.md"), `${lines.join("\n")}\n`);
