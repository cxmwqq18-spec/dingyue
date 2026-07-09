import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routePath = path.resolve(__dirname, "../src/app/api/internal/ai-worker/dispatch/route.ts");
const source = fs.readFileSync(routePath, "utf8");

const checks = [
  {
    label: "worker orders partner references before primary references",
    pass: /function providerInputAssets/.test(source) &&
      /if \(role === "partner"\) return 0;/.test(source) &&
      /if \(role === "primary"\) return 1;/.test(source)
  },
  {
    label: "prompt explicitly prevents the primary reference from supplying both people",
    pass: source.includes("Do not let PRIMARY_PERSON_REFERENCE dominate the result or supply both final people.")
  },
  {
    label: "prompt prevents the extra person in the primary photo from becoming Person B",
    pass: source.includes("Do not use an extra person from PRIMARY_PERSON_REFERENCE as Person B.")
  },
  {
    label: "provider prompt includes a machine-readable reference manifest",
    pass: source.includes("referenceManifest(payload)")
  },
  {
    label: "provider filenames include explicit reference roles",
    pass: source.includes("referenceRoleLabel(role).toLowerCase()")
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  for (const check of failed) {
    console.error(`FAIL ${check.label}`);
  }
  process.exit(1);
}

for (const check of checks) {
  console.log(`PASS ${check.label}`);
}
