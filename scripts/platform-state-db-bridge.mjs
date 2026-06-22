import fs from "node:fs";
import path from "node:path";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const documentId = "platform";
const command = process.argv[2];
const cacheFile = path.join(process.cwd(), ".next", "cache", "platform-state-postgres.json");

async function readStdin() {
  return new Promise((resolve, reject) => {
    let body = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      body += chunk;
    });
    process.stdin.on("end", () => resolve(body));
    process.stdin.on("error", reject);
  });
}

async function main() {
  if (command === "read") {
    const document = await prisma.platformStateDocument.findUnique({ where: { id: documentId } });
    if (!document?.state) {
      process.stdout.write("");
      return;
    }
    process.stdout.write(JSON.stringify(document.state));
    return;
  }

  if (command === "write") {
    const body = await readStdin();
    const state = JSON.parse(body);
    await prisma.platformStateDocument.upsert({
      where: { id: documentId },
      create: { id: documentId, state },
      update: { state }
    });
    process.stdout.write(JSON.stringify({ ok: true }));
    return;
  }

  if (command === "import") {
    const source = process.argv[3];
    if (!source || !fs.existsSync(source)) throw new Error(`state file not found: ${source}`);
    const state = JSON.parse(fs.readFileSync(source, "utf8"));
    await prisma.platformStateDocument.upsert({
      where: { id: documentId },
      create: { id: documentId, state },
      update: { state }
    });
    process.stdout.write(JSON.stringify({ ok: true }));
    return;
  }

  if (command === "clear-cache") {
    if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);
    process.stdout.write(JSON.stringify({ ok: true, cacheFile }));
    return;
  }

  throw new Error(`unknown bridge command: ${command ?? ""}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
