/**
 * Aidreamcapes 单站字段级迁移：工具名去复数 s + 页脚新增 Content。
 *
 * 规则（AGENTS.md）：
 * - 只读/写 site_aidreamcapes，不触碰 MyDreamShoots。
 * - 不做全站重生成：只对命中的字段做精确替换，逐行 compare-and-set。
 * - 默认 dry-run，必须显式传 --apply 才写入。
 *
 * 用法：
 *   node scripts/aidreamcapes-apply-plural-s-rename.mjs            # dry-run
 *   node scripts/aidreamcapes-apply-plural-s-rename.mjs --apply --confirm=site_aidreamcapes-plural-s
 */
import "./load-runtime-env.mjs";
import { PrismaClient } from "../node_modules/@prisma/client/index.js";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const SITE = "site_aidreamcapes";
const APPLY = process.argv.includes("--apply");
const CONFIRM = process.argv.find((arg) => arg.startsWith("--confirm="))?.slice("--confirm=".length);
const OUT = process.argv.find((arg) => arg.startsWith("--out="))?.slice("--out=".length);
if (APPLY) {
  if (CONFIRM !== "site_aidreamcapes-plural-s") {
    throw new Error("Writing requires --confirm=site_aidreamcapes-plural-s");
  }
}
const target = (() => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  return { host: url.hostname, port: url.port || "5432", database: url.pathname.replace(/^\/+/, "") };
})();
const prisma = new PrismaClient();

// 公开 URL 改名：旧 → 新
const PATH_MAP = [
  ["/ai-video-generation/product-videos", "/ai-video-generation/product-video"],
  ["/ai-video-generation/before-after-videos", "/ai-video-generation/before-after-video"],
  ["/ai-video-generation/spokesperson-videos", "/ai-video-generation/spokesperson-video"]
];

// 只替换"整个字符串恰好等于标签"的值，避免动到正文里的大小写变体
const LABEL_MAP = [
  ["Product Videos", "Product Video"],
  ["Before & After Videos", "Before & After Video"],
  ["Spokesperson Videos", "Spokesperson Video"]
];

const SLUG_MAP = new Map([
  ["/ai-video-generation/product-videos", "/ai-video-generation/product-video"],
  ["/ai-video-generation/before-after-videos", "/ai-video-generation/before-after-video"],
  ["/ai-video-generation/spokesperson-videos", "/ai-video-generation/spokesperson-video"]
]);

// 工作台工具 URL：公开发布的单数 ID 统一；旧复数 ID 由代码别名继续兼容。
const WORKSPACE_PATH_MAP = [
  ["/app/create/tool/product-videos", "/app/create/tool/product-video"],
  ["/app/create/tool/before-after-videos", "/app/create/tool/before-after-video"],
  ["/app/create/tool/spokesperson-videos", "/app/create/tool/spokesperson-video"]
];

// actorScenePicker.tool 会作为隐藏字段提交到工作台，必须同步单数。
const WORKSPACE_TOOL_ID_MAP = {
  "product-videos": "product-video",
  "before-after-videos": "before-after-video",
  "spokesperson-videos": "spokesperson-video"
};

// 演员页仍使用旧式 ?tool= 查询链接。把已知链接直接换成固定路径，
// 其余查询形式只做 ID 单数化（代码会把它们 308 到固定路径）。
const WORKSPACE_QUERY_MAP = [
  [
    "/app/create?tool=spokesperson-videos&size=9%3A16&length=10#step-video",
    "/app/create/spokesperson-video?size=9%3A16&length=10#step-video"
  ],
  ["?tool=product-videos", "?tool=product-video"],
  ["?tool=before-after-videos", "?tool=before-after-video"],
  ["?tool=spokesperson-videos", "?tool=spokesperson-video"]
];

function transform(node, stats) {
  if (Array.isArray(node)) return node.map((item) => transform(item, stats));
  if (node && typeof node === "object") {
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "tool" && typeof value === "string" && WORKSPACE_TOOL_ID_MAP[value]) {
        stats.workspaceToolHits += 1;
        out[key] = WORKSPACE_TOOL_ID_MAP[value];
      } else {
        out[key] = transform(value, stats);
      }
    }
    return out;
  }
  if (typeof node === "string") {
    let out = node;
    for (const [from, to] of PATH_MAP) {
      if (!out.includes(from)) continue;
      const hits = out.split(from).length - 1;
      stats.pathHits += hits;
      out = out.split(from).join(to);
    }
    for (const [from, to] of WORKSPACE_PATH_MAP) {
      if (!out.includes(from)) continue;
      const hits = out.split(from).length - 1;
      stats.workspacePathHits += hits;
      out = out.split(from).join(to);
    }
    for (const [from, to] of WORKSPACE_QUERY_MAP) {
      if (!out.includes(from)) continue;
      const hits = out.split(from).length - 1;
      stats.workspaceQueryHits += hits;
      out = out.split(from).join(to);
    }
    for (const [from, to] of LABEL_MAP) {
      if (out !== from) continue;
      stats.labelHits += 1;
      out = to;
    }
    return out;
  }
  return node;
}

function diffCount(a, b) {
  if (a === b) return 0;
  if (typeof a !== typeof b || a === null || b === null) return 1;
  if (Array.isArray(a)) {
    let n = a.length === b.length ? 0 : 1;
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) n += diffCount(a[i], b[i]);
    return n;
  }
  if (typeof a === "object") {
    let n = 0;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) n += diffCount(a[key], b[key]);
    return n;
  }
  return 1;
}

async function run() {
  console.log(`mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`target: ${target.host}:${target.port}/${target.database}`);
  const pages = await prisma.livePage.findMany({
    where: { siteId: SITE },
    select: { id: true, slug: true, contentJson: true, updatedAt: true },
    orderBy: { slug: "asc" }
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    site: SITE,
    target,
    applied: APPLY,
    pathMap: PATH_MAP,
    labelMap: LABEL_MAP,
    slugMap: [...SLUG_MAP.entries()],
    workspacePathMap: WORKSPACE_PATH_MAP,
    workspaceToolIdMap: WORKSPACE_TOOL_ID_MAP,
    workspaceQueryMap: WORKSPACE_QUERY_MAP,
    pages: [],
    footer: null
  };

  let changedPages = 0;
  let pathHits = 0;
  let labelHits = 0;
  let workspacePathHits = 0;
  let workspaceToolHits = 0;
  let workspaceQueryHits = 0;
  let renamed = 0;

  for (const page of pages) {
    const stats = { pathHits: 0, labelHits: 0, workspacePathHits: 0, workspaceToolHits: 0, workspaceQueryHits: 0 };
    const nextJson = transform(page.contentJson, stats);
    const nextSlug = SLUG_MAP.get(page.slug) ?? page.slug;
    const fields = diffCount(page.contentJson, nextJson);
    if (fields === 0 && nextSlug === page.slug) continue;

    changedPages += 1;
    pathHits += stats.pathHits;
    labelHits += stats.labelHits;
    workspacePathHits += stats.workspacePathHits;
    workspaceToolHits += stats.workspaceToolHits;
    workspaceQueryHits += stats.workspaceQueryHits;
    if (nextSlug !== page.slug) renamed += 1;

    const entry = {
      id: page.id,
      slug: page.slug,
      newSlug: nextSlug,
      fieldsChanged: fields,
      pathHits: stats.pathHits,
      labelHits: stats.labelHits,
      workspacePathHits: stats.workspacePathHits,
      workspaceToolHits: stats.workspaceToolHits,
      workspaceQueryHits: stats.workspaceQueryHits,
      expectedUpdatedAt: page.updatedAt.toISOString()
    };
    manifest.pages.push(entry);

    if (!APPLY) continue;
    const result = await prisma.livePage.updateMany({
      where: { id: page.id, updatedAt: page.updatedAt },
      data: { contentJson: nextJson, slug: nextSlug }
    });
    if (result.count !== 1) throw new Error(`CAS failed for ${page.slug}`);
    entry.appliedAt = new Date().toISOString();
  }

  // 页脚法务链接：最左侧新增 Content
  const home = await prisma.livePage.findFirst({
    where: { siteId: SITE, slug: "/" },
    select: { id: true, contentJson: true, updatedAt: true }
  });
  if (home) {
    const nav = home.contentJson?.siteNavigation ?? {};
    const legal = Array.isArray(nav.footer?.legal) ? nav.footer.legal : [];
    const already = legal.some((item) => item?.href === "/content");
    if (!already) {
      const nextLegal = [{ label: "Content", href: "/content" }, ...legal];
      const nextJson = {
        ...home.contentJson,
        siteNavigation: {
          ...nav,
          footer: { ...nav.footer, legal: nextLegal }
        }
      };
      manifest.footer = {
        id: home.id,
        before: legal,
        after: nextLegal,
        expectedUpdatedAt: home.updatedAt.toISOString(),
        fieldsChanged: diffCount(home.contentJson, nextJson)
      };
      if (APPLY) {
        const result = await prisma.livePage.updateMany({
          where: { id: home.id, updatedAt: home.updatedAt },
          data: { contentJson: nextJson }
        });
        if (result.count !== 1) throw new Error("CAS failed for footer legal links");
        manifest.footer.appliedAt = new Date().toISOString();
      }
      changedPages += 1;
    } else {
      manifest.footer = { skipped: true, reason: "Content already present" };
    }
  }

  console.log(`pages changed: ${changedPages}`);
  console.log(`slug renames: ${renamed}`);
  console.log(`path replacements: ${pathHits}`);
  console.log(`label replacements: ${labelHits}`);
  console.log(`workspace path replacements: ${workspacePathHits}`);
  console.log(`workspace tool id replacements: ${workspaceToolHits}`);
  console.log(`workspace query replacements: ${workspaceQueryHits}`);
  console.log(`footer: ${manifest.footer?.skipped ? "already present" : manifest.footer ? "Content added at index 0" : "home page missing"}`);

  // The manifest is written inside the release tree. `docs/` is not part of the
  // release archive, so a manifest path under `docs/audits/` fails with
  // ENOENT on the release host. `reports/` is created on demand.
  const out = path.resolve(
    OUT ??
      (APPLY
        ? "reports/aidreamcapes-plural-s-rename-manifest-2026-10-22.json"
        : "reports/aidreamcapes-plural-s-rename-dry-run.json")
  );
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`manifest: ${out}`);

  if (!APPLY) {
    console.log("\n=== slug renames (dry-run) ===");
    for (const page of manifest.pages.filter((item) => item.slug !== item.newSlug)) {
      console.log(`  ${page.slug} → ${page.newSlug}  (fields=${page.fieldsChanged}, paths=${page.pathHits}, labels=${page.labelHits})`);
    }
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
