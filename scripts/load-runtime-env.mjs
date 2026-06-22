import fs from "node:fs";
import path from "node:path";

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
  const index = normalized.indexOf("=");
  if (index <= 0) return null;
  const key = normalized.slice(0, index).trim();
  let value = normalized.slice(index + 1).trim();
  if (!key) return null;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return [key, value];
}

export function loadRuntimeEnv(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const files = options.files ?? [".env.local", ".env"];
  const override = options.override ?? false;
  const loaded = [];
  for (const file of files) {
    const envPath = path.resolve(cwd, file);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      const [key, value] = parsed;
      if (override || process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
    loaded.push(envPath);
  }
  return loaded;
}

loadRuntimeEnv();
