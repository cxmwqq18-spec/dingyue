#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const hostPage = read("src/app/[...path]/page.tsx");
const sitePage = read("src/app/site/[siteSlug]/[...path]/page.tsx");
const storefrontRender = read("src/lib/storefront-render.tsx");
const media = read("src/lib/media.ts");
const snapshot = read("src/lib/storefront-context/snapshot.ts");

const failures = [];
const expectAbsent = (source, pattern, label) => {
  if (pattern.test(source)) failures.push(label);
};

expectAbsent(storefrontRender, /syntheticDreamShootPartnerPage/, "synthetic partner page");
expectAbsent(storefrontRender, /fallback_blog_/, "fallback blog content");
expectAbsent(hostPage, /canUseStorefrontPartnerTemplate/, "host partner template fallback");
expectAbsent(sitePage, /dreamshootPartnerTemplateSlugs|canUseDreamShootPartnerTemplate/, "site partner template fallback");
expectAbsent(media, /const fallbackImages\s*=|fallbackImageForSeed\([^)]*\)\s*\{[^}]*fallbackImages/, "stock image fallback set");
expectAbsent(snapshot, /publication\s*=\s*[^;]+\?\?|publications\[0\]/, "public snapshot legacy fallback");

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, checked: ["public routes", "storefront renderer", "media resolver", "published snapshot"] }, null, 2));
}
