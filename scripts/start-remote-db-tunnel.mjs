import { spawnSync } from "node:child_process";
import net from "node:net";

const localHost = process.env.REMOTE_DB_LOCAL_HOST || "127.0.0.1";
const localPort = Number(process.env.REMOTE_DB_LOCAL_PORT || "15432");
const remoteHost = process.env.REMOTE_DB_SSH_HOST || "198.200.50.8";
const remoteSshPort = process.env.REMOTE_DB_SSH_PORT || "14712";
const remoteUser = process.env.REMOTE_DB_SSH_USER || "root";
const remoteDbHost = process.env.REMOTE_DB_HOST || "127.0.0.1";
const remoteDbPort = process.env.REMOTE_DB_PORT || "5432";

function isListening(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1200, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

if (await isListening(localHost, localPort)) {
  console.log(JSON.stringify({ ok: true, reused: true, local: `${localHost}:${localPort}` }, null, 2));
  process.exit(0);
}

const baseArgs = [
  "-fN",
  "-o", "StrictHostKeyChecking=accept-new",
  "-o", "ExitOnForwardFailure=yes",
  "-p", remoteSshPort,
  "-L", `${localHost}:${localPort}:${remoteDbHost}:${remoteDbPort}`,
  `${remoteUser}@${remoteHost}`
];

const password = process.env.REMOTE_DB_SSH_PASSWORD;
const command = password ? "expect" : "ssh";
const args = password
  ? [
      "-c",
      `set timeout 15
spawn ssh ${baseArgs.map((arg) => `{${arg}}`).join(" ")}
expect {
  "*assword:*" { send "${password.replace(/[$"\\]/g, "\\$&")}\\r"; exp_continue }
  eof
}`
    ]
  : baseArgs;

const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
if (result.status !== 0) {
  console.error(result.stdout);
  console.error(result.stderr);
  process.exit(result.status ?? 1);
}

if (!(await isListening(localHost, localPort))) {
  console.error(`SSH tunnel did not start on ${localHost}:${localPort}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  reused: false,
  local: `${localHost}:${localPort}`,
  remote: `${remoteHost}:${remoteSshPort} -> ${remoteDbHost}:${remoteDbPort}`
}, null, 2));
