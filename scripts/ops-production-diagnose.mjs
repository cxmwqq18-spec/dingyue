import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const service = process.env.OPS_SERVICE || "mydreamshoots.service";
const port = process.env.OPS_PORT || "3010";
const appPath = process.env.OPS_APP_PATH || "/www/wwwroot/mydreamshoots.com/app";
const releasePath = process.env.OPS_RELEASE_PATH || "/opt/dingyue/releases/20260622024452";
const platformHost = process.env.OPS_PLATFORM_HOST || "www.mydreamshoots.xyz";
const storefrontHost = process.env.OPS_STOREFRONT_HOST || "www.mydreamshoots.com";
const nginxPlatformConf = process.env.OPS_NGINX_PLATFORM_CONF || "/www/server/panel/vhost/nginx/mydreamshoots.xyz.conf";

const secretPattern = /(password|passwd|pwd|secret|token|key|credential|database_url|api[_-]?key)/i;

function maskValue(key, value) {
  if (!secretPattern.test(key)) return value;
  if (!value) return "";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

function maskLine(line) {
  return line
    .replace(/((?:password|passwd|pwd|secret|token|key|credential|database_url|api[_-]?key)[^=\s:]*\s*[=:]\s*)([^\s"']+)/gi, "$1***")
    .replace(/(postgres(?:ql)?:\/\/[^:\s]+:)([^@\s]+)(@)/gi, "$1***$3");
}

async function run(name, command, args, options = {}) {
  const started = Date.now();
  try {
    const result = await execFileAsync(command, args, {
      cwd: options.cwd,
      timeout: options.timeout ?? 15000,
      maxBuffer: options.maxBuffer ?? 1024 * 1024 * 8,
      env: process.env
    });
    return {
      name,
      ok: true,
      command: [command, ...args].join(" "),
      ms: Date.now() - started,
      stdout: result.stdout.trim().split("\n").filter(Boolean).map(maskLine),
      stderr: result.stderr.trim().split("\n").filter(Boolean).map(maskLine)
    };
  } catch (error) {
    return {
      name,
      ok: false,
      command: [command, ...args].join(" "),
      ms: Date.now() - started,
      exitCode: error.code ?? null,
      signal: error.signal ?? null,
      stdout: String(error.stdout ?? "").trim().split("\n").filter(Boolean).map(maskLine),
      stderr: String(error.stderr ?? error.message ?? "").trim().split("\n").filter(Boolean).map(maskLine)
    };
  }
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false };
  const parsed = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    parsed[key] = maskValue(key, value);
  }
  return { exists: true, keys: parsed };
}

function readProcEnv(pid) {
  const envPath = `/proc/${pid}/environ`;
  if (!pid || !fs.existsSync(envPath)) return { exists: false };
  const entries = fs.readFileSync(envPath, "utf8").split("\0").filter(Boolean);
  const selected = {};
  for (const entry of entries) {
    const index = entry.indexOf("=");
    if (index < 0) continue;
    const key = entry.slice(0, index);
    const value = entry.slice(index + 1);
    if (/^(NODE_ENV|PORT|HOSTNAME|PERSISTENCE_BACKEND|DATABASE_URL|NEXT_|SMOKE_|OPS_)/.test(key) || secretPattern.test(key)) {
      selected[key] = maskValue(key, value);
    }
  }
  return { exists: true, selected };
}

async function getMainPid() {
  const result = await run("systemd-main-pid", "systemctl", ["show", service, "-p", "MainPID", "--value"]);
  const pid = result.ok ? Number(result.stdout[0]) : 0;
  return Number.isFinite(pid) && pid > 0 ? pid : 0;
}

async function fetchProbe(name, url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12000);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      redirect: "manual",
      headers: options.headers,
      signal: controller.signal,
      cache: "no-store"
    });
    const body = options.readBody === false ? "" : await response.text().catch(() => "");
    return {
      name,
      ok: true,
      url,
      method: options.method ?? "GET",
      ms: Date.now() - started,
      status: response.status,
      location: response.headers.get("location") ?? undefined,
      server: response.headers.get("server") ?? undefined,
      cfRay: response.headers.get("cf-ray") ?? undefined,
      bytes: body.length
    };
  } catch (error) {
    return {
      name,
      ok: false,
      url,
      method: options.method ?? "GET",
      ms: Date.now() - started,
      error: error?.cause?.code || error?.code || error?.name || "fetch_failed",
      message: String(error?.message ?? error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const pid = await getMainPid();
  const cwd = fs.existsSync(appPath) ? appPath : process.cwd();
  const localBase = `http://127.0.0.1:${port}`;
  const originHttps = "https://127.0.0.1";
  const publicPlatform = `https://${platformHost}`;

  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    host: os.hostname(),
    node: process.version,
    cwd: process.cwd(),
    targets: { service, port, appPath, releasePath, platformHost, storefrontHost, nginxPlatformConf },
    files: {
      appPath: { exists: fs.existsSync(appPath), realpath: fs.existsSync(appPath) ? fs.realpathSync(appPath) : null },
      releasePath: { exists: fs.existsSync(releasePath), realpath: fs.existsSync(releasePath) ? fs.realpathSync(releasePath) : null },
      envLocal: readEnvFile(path.join(cwd, ".env.local")),
      envProduction: readEnvFile(path.join(cwd, ".env.production")),
      platformStateJson: { exists: fs.existsSync(path.join(cwd, "data", "platform-state.json")) }
    },
    process: {
      mainPid: pid,
      environ: readProcEnv(pid)
    },
    checks: [],
    probes: []
  };

  report.checks.push(await run("service-active", "systemctl", ["is-active", service]));
  report.checks.push(await run("service-status", "systemctl", ["status", service, "--no-pager", "-l"], { timeout: 12000 }));
  report.checks.push(await run("service-env", "systemctl", ["show", service, "-p", "Environment", "-p", "EnvironmentFiles", "-p", "FragmentPath", "-p", "DropInPaths", "-p", "ExecStart", "--no-pager"], { timeout: 12000 }));
  report.checks.push(await run("port-listeners", "sh", ["-lc", `ss -ltnp | grep -E '(:${port}\\b|:${port} )' || true`]));
  report.checks.push(await run("nginx-test", "nginx", ["-t"], { timeout: 12000 }));
  if (fs.existsSync(nginxPlatformConf)) {
    report.checks.push(await run("nginx-platform-vhost", "sh", ["-lc", `grep -nE 'server_name|proxy_pass|ssl_certificate|listen|include|return' '${nginxPlatformConf}'`]));
  }

  report.probes.push(await fetchProbe("origin-http-platform-root", `${localBase}/`, { headers: { host: platformHost }, readBody: false }));
  report.probes.push(await fetchProbe("origin-http-platform-login", `${localBase}/platform/login`, { headers: { host: platformHost } }));
  report.probes.push(await fetchProbe("origin-http-storefront-root", `${localBase}/`, { headers: { host: storefrontHost } }));
  report.probes.push(await fetchProbe("origin-nginx-https-platform-login", `${originHttps}/platform/login`, { headers: { host: platformHost }, readBody: false }));
  report.probes.push(await fetchProbe("cloudflare-https-platform-login", `${publicPlatform}/platform/login`, { readBody: false }));

  report.checks.push(await run("curl-cloudflare-tls", "curl", ["-Iv", "--connect-timeout", "10", "--max-time", "20", `${publicPlatform}/platform/login`], { timeout: 25000 }));
  report.checks.push(await run("openssl-cloudflare-sni", "openssl", ["s_client", "-connect", `${platformHost}:443`, "-servername", platformHost, "-brief"], { timeout: 20000 }));

  report.ok = report.checks.every((check) => check.ok || ["nginx-platform-vhost", "curl-cloudflare-tls", "openssl-cloudflare-sni"].includes(check.name));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(maskLine(error?.stack || error?.message || String(error)));
  process.exit(1);
});
