import { URL } from "node:url";

export const DATABASE_TARGETS = new Set(["local", "test", "production", "remote", "remote-readonly"]);
export const LOCAL_DATABASE = {
  host: "127.0.0.1",
  port: 15433,
  database: "dingyue_local"
};

function valueAfterFlag(args, name) {
  const exact = args.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function argumentValue(name, args = process.argv.slice(2)) {
  return valueAfterFlag(args, name);
}

export function hasArgument(name, args = process.argv.slice(2)) {
  return args.includes(name) || args.some((arg) => arg.startsWith(`${name}=`));
}

export function parseDatabaseUrl(rawUrl = process.env.DATABASE_URL) {
  if (!rawUrl?.trim()) throw new Error("DATABASE_URL is required for database operations.");
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URL.");
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error(`Unsupported DATABASE_URL protocol: ${url.protocol}`);
  }
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, "").split("?")[0]),
    schema: url.searchParams.get("schema") || "public"
  };
}

export function buildTunneledReadonlyDatabaseUrl(remoteReadonlyDatabaseUrl, { host = LOCAL_DATABASE.host, port = 15432 } = {}) {
  if (!remoteReadonlyDatabaseUrl?.trim()) {
    throw new Error("REMOTE_DB_READONLY_DATABASE_URL is required to build the remote-readonly DATABASE_URL.");
  }
  const url = new URL(remoteReadonlyDatabaseUrl);
  url.hostname = host;
  url.port = String(port);
  return url.toString();
}

export function buildTunneledDatabaseUrl(remoteDatabaseUrl, options = {}) {
  if (!remoteDatabaseUrl?.trim()) {
    throw new Error("REMOTE_DB_DATABASE_URL is required to build the remote DATABASE_URL.");
  }
  return buildTunneledReadonlyDatabaseUrl(remoteDatabaseUrl, options);
}

export function databaseTargetSummary(env = process.env) {
  const parsed = parseDatabaseUrl(env.DATABASE_URL);
  return {
    environment: env.DINGYUE_ENV || "",
    target: env.DATABASE_TARGET || "",
    ...parsed
  };
}

function assertEnvironmentLabel(expectedTarget, env) {
  const environment = String(env.DINGYUE_ENV || "").trim().toLowerCase();
  const target = String(env.DATABASE_TARGET || "").trim().toLowerCase();
  if (!DATABASE_TARGETS.has(expectedTarget)) throw new Error(`Unknown database target: ${expectedTarget}`);
  if (target !== expectedTarget) {
    throw new Error(`DATABASE_TARGET=${target || "(unset)"} does not match required target ${expectedTarget}.`);
  }
  if (expectedTarget === "remote-readonly" || expectedTarget === "remote") {
    if (environment !== "remote-readonly") {
      if (expectedTarget !== "remote" || environment !== "remote") {
        throw new Error(`Remote database access requires DINGYUE_ENV=${expectedTarget}.`);
      }
    }
    return;
  }
  if (environment !== expectedTarget) {
    throw new Error(`DINGYUE_ENV=${environment || "(unset)"} does not match required target ${expectedTarget}.`);
  }
}

export function assertDatabaseTarget({
  expectedTarget,
  env = process.env,
  requireProductionConfirmation = false,
  productionConfirmed = false
}) {
  assertEnvironmentLabel(expectedTarget, env);
  const parsed = parseDatabaseUrl(env.DATABASE_URL);
  if (parsed.port === 15432 && !["remote", "remote-readonly"].includes(expectedTarget)) {
    throw new Error("Refusing database operations through the remote tunnel port 15432 unless DATABASE_TARGET=remote or remote-readonly.");
  }
  if (expectedTarget === "remote-readonly" || expectedTarget === "remote") {
    if (!new Set(["127.0.0.1", "localhost", "::1"]).has(parsed.host) || parsed.port !== 15432) {
      throw new Error(
        `Remote database targets must use the local SSH tunnel on 127.0.0.1:15432; received ${parsed.host}:${parsed.port}/${parsed.database}.`
      );
    }
  }
  if (expectedTarget === "local") {
    if (
      parsed.host !== LOCAL_DATABASE.host ||
      parsed.port !== LOCAL_DATABASE.port ||
      parsed.database !== LOCAL_DATABASE.database
    ) {
      throw new Error(
        `Local database target must be ${LOCAL_DATABASE.host}:${LOCAL_DATABASE.port}/${LOCAL_DATABASE.database}; ` +
          `received ${parsed.host}:${parsed.port}/${parsed.database}.`
      );
    }
  }
  if (expectedTarget === "production" && requireProductionConfirmation && !productionConfirmed) {
    throw new Error("Production database operations require an explicit production confirmation.");
  }
  return {
    environment: expectedTarget,
    target: expectedTarget,
    ...parsed
  };
}

export function assertNonProductionWriteTarget(env = process.env) {
  const target = String(env.DATABASE_TARGET || "").trim().toLowerCase();
  const environment = String(env.DINGYUE_ENV || "").trim().toLowerCase();
  if (!DATABASE_TARGETS.has(target)) {
    throw new Error(`Database writes require a known DATABASE_TARGET; received ${target || "(unset)"}.`);
  }
  if (target === "production" || environment === "production") {
    throw new Error("Full state import is disabled for production. Use the scoped release content pipeline.");
  }
  if (target === "remote-readonly" || environment === "remote-readonly") {
    throw new Error("Database writes are disabled for remote-readonly targets.");
  }
  if (!target || !environment) {
    throw new Error("Database writes require explicit DINGYUE_ENV and DATABASE_TARGET values.");
  }
  return assertDatabaseTarget({ expectedTarget: target, env });
}

export function assertAllowedSite(siteId) {
  const allowed = new Set(["site_dreamshoot", "site_grownstride_test"]);
  if (!allowed.has(siteId)) {
    throw new Error(`Release content is restricted to MyDreamShoots sites; refusing site ${siteId}.`);
  }
  return siteId;
}
