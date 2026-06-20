import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateFile = path.join(repoRoot, "data", "platform-state.json");
const schemaFile = path.join(repoRoot, "src", "lib", "section-schema.ts");
const rendererFile = path.join(repoRoot, "src", "components", "theme-renderer.tsx");

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

function valuePresent(value) {
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return true;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
}

function pageBySlug(site, slug) {
  const page = site.pages.find((item) => item.slug === slug);
  assert(page, `missing page ${slug}`);
  return page;
}

function sectionById(page, mode, id, type) {
  const pageJson = mode === "draft" ? page.draftJson : page.publishedJson;
  const section = pageJson.sections[id];
  assert(section, `${page.slug} ${mode} missing section ${id}`);
  assert(section.type === type, `${page.slug} ${mode} section ${id} expected ${type}, got ${section.type}`);
  assert(pageJson.sectionsOrder.includes(id), `${page.slug} ${mode} sectionsOrder missing ${id}`);
  return section;
}

function assertSettings(section, pageSlug, mode, id, fields) {
  for (const field of fields) {
    assert(
      valuePresent(section.settings?.[field]),
      `${pageSlug} ${mode} ${id} (${section.type}) missing editable setting ${field}`
    );
  }
}

function assertBlocks(section, pageSlug, mode, id, minBlocks, fields) {
  assert(Array.isArray(section.blocks), `${pageSlug} ${mode} ${id} blocks must be an array`);
  assert(section.blocks.length >= minBlocks, `${pageSlug} ${mode} ${id} expected at least ${minBlocks} blocks`);
  for (const block of section.blocks.slice(0, minBlocks)) {
    for (const field of fields) {
      assert(valuePresent(block.settings?.[field]), `${pageSlug} ${mode} ${id}.${block.id} missing block setting ${field}`);
    }
  }
}

const requiredFieldsByType = {
  media_banner: ["eyebrow", "title", "subtitle", "imageUrl", "imageCaption", "imageMeta", "ctaLabel", "ctaHref"],
  ai_feature_launcher: ["eyebrow", "title", "subtitle"],
  ai_tool_entry: ["aiAppSlug", "eyebrow", "title", "subtitle", "imageUrl", "ctaLabel"],
  upload_panel: ["eyebrow", "title", "subtitle", "helper", "imageUrl", "emptyTitle", "emptyBody"],
  generation_form: ["aiAppSlug", "eyebrow", "title", "subtitle", "helper", "imageUrl", "emptyTitle", "emptyBody"],
  job_progress: ["eyebrow", "title", "subtitle", "imageUrl", "emptyTitle", "emptyBody"],
  album_gallery: ["eyebrow", "title", "subtitle", "imageUrl", "emptyTitle", "emptyBody", "showDownloads"],
  login_method_panel: ["eyebrow", "title", "subtitle", "emailPlaceholder", "buttonLabel", "actionHref", "imageUrl", "secondaryImageUrl", "imageBadge", "imageCaption", "imageMeta"],
  rich_text: ["eyebrow", "title", "body"],
  pricing_table: ["featuredProductId", "productType", "title", "subtitle"],
  job_detail: ["eyebrow", "title", "subtitle", "showLedger", "showAssets"],
  faq: ["eyebrow", "title", "subtitle"],
  policy_content: ["title", "body"],
  blog_list: ["title", "body"]
};

const pageRequirements = [
  {
    slug: "/tools/image-studio",
    sections: [
      ["tool_hero_1", "media_banner"],
      ["entry_1", "ai_tool_entry"],
      ["upload_1", "upload_panel"],
      ["form_1", "generation_form"],
      ["progress_1", "job_progress"],
      ["album_1", "album_gallery"]
    ]
  },
  {
    slug: "/app",
    sections: [
      ["workspace_1", "ai_feature_launcher"],
      ["upload_1", "upload_panel"],
      ["form_1", "generation_form"],
      ["progress_1", "job_progress"],
      ["album_1", "album_gallery"]
    ]
  },
  {
    slug: "/app/jobs/progress",
    sections: [
      ["job_intro_1", "rich_text"],
      ["progress_1", "job_progress"],
      ["album_1", "album_gallery"]
    ]
  },
  {
    slug: "/app/jobs/detail",
    sections: [
      ["job_detail_1", "job_detail"],
      ["album_1", "album_gallery"]
    ]
  },
  {
    slug: "/album",
    sections: [
      ["album_intro_1", "media_banner"],
      ["album_1", "album_gallery"],
      ["account_ops_1", "ai_feature_launcher"]
    ]
  },
  {
    slug: "/account",
    sections: [
      ["billing_intro_1", "rich_text"],
      ["account_ops_1", "ai_feature_launcher"],
      ["pricing_1", "pricing_table"],
      ["album_1", "album_gallery"]
    ]
  },
  {
    slug: "/login",
    sections: [
      ["login_1", "login_method_panel"],
      ["trust_1", "trust_signal_bar"]
    ]
  },
  {
    slug: "/help",
    sections: [
      ["help_intro_1", "rich_text"],
      ["faq_1", "faq"],
      ["blog_list_1", "blog_list"]
    ]
  },
  {
    slug: "/policies/privacy",
    sections: [
      ["policy_1", "policy_content"]
    ]
  },
  {
    slug: "/policies/refunds",
    sections: [
      ["policy_1", "policy_content"]
    ]
  },
  {
    slug: "/policies/content",
    sections: [
      ["policy_1", "policy_content"]
    ]
  }
];

const state = readJson(stateFile);
const schemaText = readText(schemaFile);
const rendererText = readText(rendererFile);
const site = state.sites.find((item) => item.slug === "lumen");
assert(site, "missing lumen site");

for (const marker of [
  "upload_panel",
  "generation_form",
  "job_progress",
  "album_gallery",
  "ai_feature_launcher",
  "media_banner",
  "login_method_panel",
  "job_detail"
]) {
  assert(schemaText.includes(`${marker}: {`), `section schema missing ${marker}`);
  assert(rendererText.includes(`section.type === "${marker}"`) || rendererText.includes(`section.type === "${marker}" ||`) || rendererText.includes(`|| section.type === "${marker}"`), `renderer missing ${marker}`);
}

const checked = [];

for (const requirement of pageRequirements) {
  const page = pageBySlug(site, requirement.slug);
  for (const mode of ["draft", "published"]) {
    const pageJson = mode === "draft" ? page.draftJson : page.publishedJson;
    assert(pageJson.sectionsOrder.length >= requirement.sections.length, `${requirement.slug} ${mode} has too few sections`);
    for (const [id, type] of requirement.sections) {
      const section = sectionById(page, mode, id, type);
      const fields = requiredFieldsByType[type] ?? [];
      assertSettings(section, requirement.slug, mode, id, fields);
      if (type === "ai_feature_launcher") {
        assertBlocks(section, requirement.slug, mode, id, 3, ["title", "description", "meta", "href"]);
      }
      if (type === "login_method_panel") {
        assertBlocks(section, requirement.slug, mode, id, 2, ["label", "helper", "kind", "href"]);
      }
      if (type === "faq") {
        assertBlocks(section, requirement.slug, mode, id, 5, ["question", "answer"]);
      }
      if (type === "policy_content") {
        assert(String(section.settings?.body ?? "").includes("<p>"), `${requirement.slug} ${mode} policy content must keep editable rich policy copy`);
      }
    }
  }
  checked.push({
    slug: requirement.slug,
    sections: requirement.sections.map(([id, type]) => ({ id, type }))
  });
}

const products = state.products.filter((product) => product.siteId === site.id && product.type === "subscription" && product.status === "active");
const accountPage = pageBySlug(site, "/account");
const accountPricing = sectionById(accountPage, "published", "pricing_1", "pricing_table");
assert(accountPricing.settings.featuredProductId === "prod_lumen_premium", "/account pricing section must bind the live Premium plan");
assert(products.length === 3, `expected 3 active subscription products for Lumen, got ${products.length}`);

console.log(JSON.stringify({
  site: site.slug,
  checkedPages: checked,
  customerJourneySections: checked.reduce((total, page) => total + page.sections.length, 0),
  activeSubscriptionProducts: products.map((product) => product.id)
}, null, 2));
