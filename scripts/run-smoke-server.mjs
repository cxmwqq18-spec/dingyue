import { spawn } from "node:child_process";

const suite = process.argv[2];
if (!suite) {
  console.error("Usage: npm run smoke:server -- <npm-script>");
  process.exit(1);
}

const port = process.env.SMOKE_SERVER_PORT || "3210";
const baseUrl = process.env.SMOKE_BASE_URL || `http://localhost:${port}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  const deadline = Date.now() + 60000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/platform/state`, { cache: "no-store" });
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(750);
  }
  throw lastError || new Error(`server_not_ready:${baseUrl}`);
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env });
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with ${code ?? signal}`));
    });
    child.on("error", reject);
  });
}

const env = {
  ...process.env,
  PORT: port,
  SMOKE_BASE_URL: baseUrl,
  NEXT_TELEMETRY_DISABLED: "1"
};

const server = spawn("npm", ["run", "dev"], { stdio: "inherit", env });
let exiting = false;

async function shutdown() {
  if (exiting) return;
  exiting = true;
  server.kill("SIGTERM");
  await sleep(1000);
}

process.on("SIGINT", () => shutdown().finally(() => process.exit(130)));
process.on("SIGTERM", () => shutdown().finally(() => process.exit(143)));

try {
  await waitForServer();
  await run("npm", ["run", suite], env);
} finally {
  await shutdown();
}
