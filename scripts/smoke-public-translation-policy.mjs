import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicSurfaceRoots = [
  "src/app/site",
  "src/components/theme-renderer.tsx",
  "src/components/storefront",
  "src/components/app",
  "src/lib/storefront-render.tsx",
  "src/lib/theme",
  "src/lib/dreamshoot-seo-content.ts"
];

const blockedPatterns = [
  { label: "notranslate class or token", pattern: /\bnotranslate\b/i },
  { label: "translate=no attribute", pattern: /\btranslate\s*=\s*["']no["']/i },
  { label: "translate={false} attribute", pattern: /\btranslate\s*=\s*\{\s*false\s*\}/i },
  { label: "translate={'no'} attribute", pattern: /\btranslate\s*=\s*\{\s*["']no["']\s*\}/i },
  { label: "google notranslate meta", pattern: /name\s*=\s*["']google["'][\s\S]{0,160}content\s*=\s*["']notranslate["']/i }
];

function walk(target) {
  const fullPath = path.join(root, target);
  if (!fs.existsSync(fullPath)) return [];
  const stat = fs.statSync(fullPath);
  if (stat.isFile()) return [fullPath];
  return fs.readdirSync(fullPath, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || entry.name === "node_modules") return [];
    const child = path.join(target, entry.name);
    return walk(child);
  });
}

const allowedExtensions = new Set([".tsx", ".ts", ".jsx", ".js", ".mjs", ".json", ".html"]);
const files = publicSurfaceRoots
  .flatMap(walk)
  .filter((file) => allowedExtensions.has(path.extname(file)));

const violations = [];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const lines = source.split(/\r?\n/);
  for (const rule of blockedPatterns) {
    lines.forEach((line, index) => {
      if (rule.pattern.test(line)) {
        violations.push({
          file: path.relative(root, file),
          line: index + 1,
          rule: rule.label,
          text: line.trim()
        });
      }
    });
  }
}

if (violations.length) {
  console.error("Public storefront translation policy failed.");
  console.error("MyDreamShoots and Aidreamcapes public pages must not disable browser translation.");
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line} ${violation.rule}: ${violation.text}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checkedFiles: files.length, policy: "public storefront translation enabled" }, null, 2));
