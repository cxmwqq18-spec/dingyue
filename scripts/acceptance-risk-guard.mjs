import { spawnSync } from "node:child_process";

const suites = ["smoke:security-baseline", "smoke:designer-concurrency", "smoke:storage-health"];

for (const suite of suites) {
  const args = suite === "smoke:storage-health" ? ["run", suite] : ["run", "smoke:server", "--", suite];
  const result = spawnSync("npm", args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SMOKE_SERVER_PORT: suite === "smoke:designer-concurrency" ? "3212" : "3211",
      NEXT_TELEMETRY_DISABLED: "1"
    },
    stdio: "inherit"
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(JSON.stringify({ ok: true, suites }, null, 2));
