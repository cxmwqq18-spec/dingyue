// Renames AIVideosUGC actor portrait assets to per-actor slugs.
//
// The storefront used to address actor portraits by their scene-catalog
// filename (/ai-image-generation/actors/ac1-actor-card-office-2-r1-640.webp
// for /ai-actors/nisha). This script derives each actor's public slug from
// the authoritative catalog (scripts/data/aidreamcapes-site-v2/content/
// ai-actors.json: {id, name, ref}) and materializes slug-named copies:
//
//   public/ai-image-generation/actors/<slug>-640.webp
//   public/assets/sites/site_aidreamcapes/v2-responsive/ai-image-generation/actors/<slug>-640--320.webp
//
// plus matching entries in the responsive-image manifest. Old files and old
// manifest keys stay, so external links and cached HTML keep working. The
// script is idempotent — re-run it after content rebuilds. On --apply it also
// writes the URL pair manifest (scripts/manifests/) that
// scripts/apply-aivideosugc-actor-portrait-urls.mjs consumes to repoint the
// LivePage rows in the database.

import fs from "node:fs";
import path from "node:path";

const apply = process.argv.includes("--apply");
const root = process.cwd();
const catalogPath = path.join(root, "scripts/data/aidreamcapes-site-v2/content/ai-actors.json");
const manifestPath = path.join(root, "src/lib/aidreamcapes-v2-responsive-image-manifest.json");
const actorsDir = path.join(root, "public/ai-image-generation/actors");
const responsiveDir = path.join(root, "public/assets/sites/site_aidreamcapes/v2-responsive/ai-image-generation/actors");
const pairsOutPath = path.join(root, "scripts/manifests/aidreamcapes-actor-portrait-rename-pairs.json");
const PUBLIC_PREFIX = "/ai-image-generation/actors";
const RESPONSIVE_PREFIX = "/assets/sites/site_aidreamcapes/v2-responsive/ai-image-generation/actors";

const slugify = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const cards = catalog.actor_cards ?? [];
if (!cards.length) throw new Error(`no actor_cards in ${catalogPath}`);

const mappings = [];
const problems = [];
for (const card of cards) {
  const slug = slugify(card.name);
  if (!slug) { problems.push(`${card.name}: empty slug`); continue; }
  const catalogBase = String(card.ref ?? "").split(":").pop();
  if (!/^[a-z0-9]+-/.test(catalogBase)) { problems.push(`${card.name}: unexpected ref ${card.ref}`); continue; }
  mappings.push({
    id: card.id,
    name: card.name,
    slug,
    oldPublic: `${PUBLIC_PREFIX}/${catalogBase}-640.webp`,
    newPublic: `${PUBLIC_PREFIX}/${slug}-640.webp`,
    oldVariant: `${RESPONSIVE_PREFIX}/${catalogBase}-640--320.webp`,
    newVariant: `${RESPONSIVE_PREFIX}/${slug}-640--320.webp`,
    catalogFile: path.join(actorsDir, `${catalogBase}-640.webp`),
    variantFile: path.join(responsiveDir, `${catalogBase}-640--320.webp`)
  });
}
for (const mapping of mappings) {
  if (!fs.existsSync(mapping.catalogFile)) problems.push(`${mapping.name}: missing source file ${mapping.catalogFile}`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
const bySlug = new Map(mappings.map((m) => [m.slug, m]));
for (const mapping of mappings) {
  if (bySlug.get(mapping.slug) !== mapping) { console.error(`duplicate slug ${mapping.slug}`); process.exit(1); }
}

if (apply) {
  for (const mapping of mappings) {
    if (!fs.existsSync(mapping.catalogFile)) { console.error(`MISSING source ${mapping.catalogFile} (${mapping.name})`); process.exit(1); }
    if (!fs.existsSync(mapping.variantFile)) console.warn(`note: no 320w variant for ${mapping.name} (${mapping.oldVariant})`);
    if (!fs.existsSync(mapping.newPublic)) fs.copyFileSync(mapping.catalogFile, path.join(actorsDir, `${mapping.slug}-640.webp`));
    if (fs.existsSync(mapping.variantFile) && !fs.existsSync(path.join(responsiveDir, `${mapping.slug}-640--320.webp`))) {
      fs.copyFileSync(mapping.variantFile, path.join(responsiveDir, `${mapping.slug}-640--320.webp`));
    }
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  let added = 0;
  for (const mapping of mappings) {
    const source = manifest[mapping.oldPublic];
    if (!source) { console.warn(`manifest has no entry for ${mapping.oldPublic}, skipped`); continue; }
    if (manifest[mapping.newPublic]) continue;
    manifest[mapping.newPublic] = {
      original: mapping.newPublic,
      width: source.width,
      height: source.height,
      variants: (source.variants ?? []).map((variant) => ({ ...variant, url: variant.url.replace(mapping.oldPublic.replace(/\.webp$/, ""), mapping.newPublic.replace(/\.webp$/, "")) }))
    };
    added += 1;
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const pairs = mappings.flatMap((m) => [
    { from: m.oldPublic, to: m.newPublic },
    { from: m.oldVariant, to: m.newVariant }
  ]);
  fs.writeFileSync(pairsOutPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), pairs }, null, 2)}\n`);
  console.log(`applied: ${mappings.length} portrait copies, ${added} manifest entries added, ${pairs.length} URL pairs -> ${path.relative(root, pairsOutPath)}`);
} else {
  console.log(`dry run: ${mappings.length} mappings (pass --apply to copy files, update the manifest and write the URL pairs)`);
}
