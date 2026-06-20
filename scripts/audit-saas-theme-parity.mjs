import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageFile = path.join(repoRoot, "data", "saas-theme-packages.json");
const publicThemesRoot = path.join(repoRoot, "public", "themes");

const requiredTemplates = ["404", "cart", "collection", "index", "page", "product", "search"];
const requiredGlobalSections = ["header_plus", "footer_plus"];
const requiredActions = ["change", "dropition", "dropitem", "delition", "delitem", "addition", "additem"];
const requiredPresetCategories = ["商品", "素材", "导航", "营销", "基础"];
const recognizedFieldTypes = new Set([
  "header",
  "paragraph",
  "text",
  "textarea",
  "richtext",
  "html",
  "video_url",
  "checkbox",
  "color",
  "image_picker",
  "font_picker",
  "range",
  "select",
  "custom_select",
  "collection",
  "url",
  "product",
  "price",
  "ai_app",
  "media_asset",
  "page",
  "blog",
  "link_list",
  "menu",
  "popover"
]);

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectFields(themePackage) {
  const fields = [];
  for (const group of themePackage.settingsSchema ?? []) {
    fields.push(...(group.settings ?? []));
  }
  for (const section of Object.values(themePackage.sections ?? {})) {
    fields.push(...(section.schema.settings ?? []));
    for (const block of section.schema.blocks ?? []) fields.push(...(block.settings ?? []));
  }
  return fields;
}

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const entryPath = path.join(dir, entry.name);
    total += entry.isDirectory() ? countFiles(entryPath) : 1;
  }
  return total;
}

const registry = readJson(packageFile);
const themeKeys = registry.summary?.themeKeys ?? [];
if (themeKeys.length < 12) fail(`expected at least 12 SaaS themes, got ${themeKeys.length}`);

const report = {
  themes: themeKeys.length,
  templates: registry.summary.counts.templates,
  sections: registry.summary.counts.sections,
  fieldTypes: new Set(),
  sectionPresets: 0,
  sectionPresetCategories: new Set(),
  presetBlocks: 0,
  copiedThemeAssets: 0,
  editProtocol: requiredActions
};

for (const themeKey of themeKeys) {
  const themePackage = registry.packages?.[themeKey];
  if (!themePackage) fail(`missing package for ${themeKey}`);
  for (const templateName of requiredTemplates) {
    if (!themePackage.templates?.[templateName]) fail(`${themeKey} missing required template ${templateName}`);
  }
  for (const sectionName of requiredGlobalSections) {
    if (!themePackage.sections?.[sectionName]) fail(`${themeKey} missing global section ${sectionName}`);
    const sectionDefaults = themePackage.settingsData?.current?.sections?.[sectionName];
    if (!sectionDefaults?.settings || !Array.isArray(sectionDefaults.blocks)) {
      fail(`${themeKey} settings_data.current.sections.${sectionName} is not an original SaaS section shape`);
    }
  }
  if (!Array.isArray(themePackage.settingsSchema) || themePackage.settingsSchema.length < 5) {
    fail(`${themeKey} settings_schema is incomplete`);
  }
  if (!themePackage.settingsData?.current || Object.keys(themePackage.settingsData.current).length < 20) {
    fail(`${themeKey} settings_data.current is incomplete`);
  }
  const fields = collectFields(themePackage);
  for (const [sectionName, section] of Object.entries(themePackage.sections ?? {})) {
    const presets = section.schema?.presets ?? [];
    if (presets.length && !presets[0].cname) fail(`${themeKey}/${sectionName} first preset is missing original cname metadata`);
    for (const preset of presets) {
      report.sectionPresets += 1;
      const category = preset.category?.["zh-CN"] ?? preset.category?.["en-US"] ?? preset.ccategory?.["zh-CN"] ?? preset.ccategory?.["en-US"] ?? "";
      if (category) report.sectionPresetCategories.add(category);
      report.presetBlocks += Array.isArray(preset.blocks) ? preset.blocks.length : 0;
    }
  }
  for (const field of fields) {
    if (!field.type) continue;
    report.fieldTypes.add(field.type);
    if (!recognizedFieldTypes.has(field.type)) fail(`${themeKey} has unrecognized field type ${field.type}`);
  }
  for (const category of requiredPresetCategories) {
    if (!report.sectionPresetCategories.has(category)) {
      fail(`${themeKey} missing original SaaS preset category ${category}`);
    }
  }
  const assetCount = countFiles(path.join(publicThemesRoot, themeKey));
  if (assetCount < themePackage.counts.templates + themePackage.counts.sections) {
    fail(`${themeKey} public theme assets are not copied; found ${assetCount} files`);
  }
  report.copiedThemeAssets += assetCount;
}

const result = {
  themes: report.themes,
  templates: report.templates,
  sections: report.sections,
  fieldTypes: [...report.fieldTypes].sort(),
  sectionPresets: report.sectionPresets,
  sectionPresetCategories: [...report.sectionPresetCategories].sort(),
  presetBlocks: report.presetBlocks,
  copiedThemeAssets: report.copiedThemeAssets,
  editProtocol: report.editProtocol
};

console.log(JSON.stringify(result, null, 2));
