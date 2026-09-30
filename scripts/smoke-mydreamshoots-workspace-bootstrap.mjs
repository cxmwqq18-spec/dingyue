import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("src/lib/stores/site-store.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const bootstrapStart = source.indexOf("export async function getCustomerWorkspaceBootstrapRelational");
const bootstrapEnd = source.indexOf("export async function getSiteLoginShellBySlugForAdmin", bootstrapStart);

if (bootstrapStart < 0 || bootstrapEnd < 0) {
  throw new Error("workspace bootstrap function boundary not found");
}

const bootstrapSource = source.slice(bootstrapStart, bootstrapEnd);
if (bootstrapSource.includes("fallbackCustomerWorkspaceAidreamcapesNavigation(slug)")) {
  throw new Error("workspace bootstrap must not call the disabled legacy PlatformStateDocument fallback");
}

if (!bootstrapSource.includes("aidreamcapesZipNavigation: liveSnapshot?.themeSettings?.aidreamcapesZipNavigation")) {
  throw new Error("workspace bootstrap must preserve the relational navigation projection");
}

console.log("OK: workspace bootstrap does not eagerly invoke the disabled legacy state fallback");
