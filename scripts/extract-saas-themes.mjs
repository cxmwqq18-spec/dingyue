import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const themesRoot = process.env.SAAS_THEMES_ROOT ?? "/Users/cxm/saas/themes";
const outputFile = path.join(repoRoot, "data", "saas-theme-packages.json");
const publicThumbRoot = path.join(repoRoot, "public", "assets", "saas-themes");
const publicThemeRoot = path.join(repoRoot, "public", "themes");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function readTemplate(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  try {
    return JSON.parse(raw);
  } catch {
    return { liquid: raw };
  }
}

function extractSchema(filePath) {
  const liquid = fs.readFileSync(filePath, "utf8");
  const match = liquid.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch (error) {
    return { __schema_parse_error: error instanceof Error ? error.message : "invalid_schema_json" };
  }
}

function listFiles(dir, extension) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith(extension))
    .sort((a, b) => a.localeCompare(b));
}

function hasThemeShape(dir) {
  return fs.existsSync(path.join(dir, "templates")) &&
    fs.existsSync(path.join(dir, "sections")) &&
    fs.existsSync(path.join(dir, "config"));
}

function copyDir(source, target) {
  if (!fs.existsSync(source)) return;
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

function extractTheme(themeKey) {
  const sourceRoot = path.join(themesRoot, themeKey);
  const templatesDir = path.join(sourceRoot, "templates");
  const sectionsDir = path.join(sourceRoot, "sections");
  const configDir = path.join(sourceRoot, "config");
  const thumbSource = path.join(sourceRoot, "thumbs.png");
  const thumbUrl = `/assets/saas-themes/${themeKey}/thumbs.png`;

  copyDir(sourceRoot, path.join(publicThemeRoot, themeKey));

  if (fs.existsSync(thumbSource)) {
    const thumbOutputDir = path.join(publicThumbRoot, themeKey);
    fs.mkdirSync(thumbOutputDir, { recursive: true });
    fs.copyFileSync(thumbSource, path.join(thumbOutputDir, "thumbs.png"));
  }

  const templates = Object.fromEntries(
    listFiles(templatesDir, ".liquid").map((file) => [
      path.basename(file, ".liquid"),
      readTemplate(path.join(templatesDir, file))
    ])
  );

  const sections = {};
  const skippedSections = [];
  for (const file of listFiles(sectionsDir, ".liquid")) {
    const schema = extractSchema(path.join(sectionsDir, file));
    if (!schema) {
      skippedSections.push({ file, reason: "no_schema" });
      continue;
    }
    if ("__schema_parse_error" in schema) {
      skippedSections.push({ file, reason: `schema_parse_error:${schema.__schema_parse_error}` });
      continue;
    }
    const name = schema.name ?? path.basename(file, ".liquid");
    sections[name] = {
      file,
      schema,
      liquid: fs.readFileSync(path.join(sectionsDir, file), "utf8")
    };
  }

  const settingsSchema = readJson(path.join(configDir, "settings_schema.json"), []);
  const settingsData = readJson(path.join(configDir, "settings_data.json"), { current: {}, presets: [] });
  const fieldTypes = new Set();
  for (const group of settingsSchema) {
    for (const field of group.settings ?? []) fieldTypes.add(field.type);
  }
  for (const section of Object.values(sections)) {
    for (const field of section.schema.settings ?? []) fieldTypes.add(field.type);
    for (const block of section.schema.blocks ?? []) {
      for (const field of block.settings ?? []) fieldTypes.add(field.type);
    }
  }

  return {
    themeKey,
    sourceRoot,
    extractedAt: new Date().toISOString(),
    counts: {
      templates: Object.keys(templates).length,
      sections: Object.keys(sections).length,
      skippedSections: skippedSections.length,
      settingsGroups: Array.isArray(settingsSchema) ? settingsSchema.length : 0
    },
    thumbnailUrl: fs.existsSync(thumbSource) ? thumbUrl : null,
    supportedFieldTypes: [...fieldTypes].filter(Boolean).sort((a, b) => String(a).localeCompare(String(b))),
    templateNames: Object.keys(templates),
    sectionNames: Object.keys(sections),
    skippedSections,
    templates,
    settingsSchema,
    settingsData,
    sections
  };
}

const themeKeys = fs.readdirSync(themesRoot)
  .filter((name) => hasThemeShape(path.join(themesRoot, name)))
  .sort((a, b) => a.localeCompare(b));

const packages = Object.fromEntries(themeKeys.map((themeKey) => [themeKey, extractTheme(themeKey)]));
const summary = {
  sourceRoot: themesRoot,
  extractedAt: new Date().toISOString(),
  themeKeys,
  counts: {
    themes: themeKeys.length,
    templates: Object.values(packages).reduce((sum, item) => sum + item.counts.templates, 0),
    sections: Object.values(packages).reduce((sum, item) => sum + item.counts.sections, 0),
    skippedSections: Object.values(packages).reduce((sum, item) => sum + item.counts.skippedSections, 0)
  }
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify({ summary, packages }, null, 2)}\n`);
console.log(`Extracted ${summary.counts.themes} SaaS themes, ${summary.counts.templates} templates, ${summary.counts.sections} sections to ${outputFile}`);
