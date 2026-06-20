import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = process.env.SAAS_THEME1_ROOT ?? "/Users/cxm/saas/themes/theme1";
const outputFile = path.join(repoRoot, "data", "saas-theme1-package.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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
  return JSON.parse(match[1].trim());
}

function listFiles(dir, extension) {
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith(extension))
    .sort((a, b) => a.localeCompare(b));
}

const templatesDir = path.join(sourceRoot, "templates");
const sectionsDir = path.join(sourceRoot, "sections");
const configDir = path.join(sourceRoot, "config");

const templates = Object.fromEntries(
  listFiles(templatesDir, ".liquid").map((file) => [path.basename(file, ".liquid"), readTemplate(path.join(templatesDir, file))])
);

const sections = {};
const skippedSections = [];
for (const file of listFiles(sectionsDir, ".liquid")) {
  const schema = extractSchema(path.join(sectionsDir, file));
  if (!schema) {
    skippedSections.push({ file, reason: "no_schema" });
    continue;
  }
  sections[schema.name ?? path.basename(file, ".liquid")] = {
    file,
    schema,
    liquid: fs.readFileSync(path.join(sectionsDir, file), "utf8")
  };
}

const settingsSchema = readJson(path.join(configDir, "settings_schema.json"));
const settingsData = readJson(path.join(configDir, "settings_data.json"));
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

const packageJson = {
  themeKey: "theme1",
  sourceRoot,
  extractedAt: new Date().toISOString(),
  counts: {
    templates: Object.keys(templates).length,
    sections: Object.keys(sections).length,
    skippedSections: skippedSections.length,
    settingsGroups: settingsSchema.length
  },
  supportedFieldTypes: [...fieldTypes].sort((a, b) => a.localeCompare(b)),
  templateNames: Object.keys(templates),
  sectionNames: Object.keys(sections),
  skippedSections,
  templates,
  settingsSchema,
  settingsData,
  sections
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log(`Extracted ${packageJson.counts.templates} templates and ${packageJson.counts.sections} sections to ${outputFile}`);
