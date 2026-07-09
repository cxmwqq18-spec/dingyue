import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routePath = path.resolve(__dirname, "../src/app/api/internal/ai-worker/dispatch/route.ts");
const jobStorePath = path.resolve(__dirname, "../src/lib/stores/job-store.ts");
const source = fs.readFileSync(routePath, "utf8");
const jobStoreSource = fs.readFileSync(jobStorePath, "utf8");

const checks = [
  {
    label: "worker orders partner references before primary references",
    pass: /function providerInputAssets/.test(source) &&
      /if \(role === "partner"\) return 0;/.test(source) &&
      /if \(role === "primary"\) return 1;/.test(source)
  },
  {
    label: "worker does not force couple jobs down to exactly two people",
    pass: !source.includes("exactly two visible adult people")
  },
  {
    label: "job creation prompt does not force couple jobs down to exactly two people",
    pass: !jobStoreSource.includes("exactly two visible adult people")
  },
  {
    label: "worker preserves clear extra people from primary references",
    pass: source.includes("Do not discard clear additional people visible in PRIMARY_PERSON_REFERENCE images.")
  },
  {
    label: "job creation prompt preserves three-person source combinations",
    pass: jobStoreSource.includes("primary selected photo shows two clear people and the partner selected photo shows one clear person")
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
