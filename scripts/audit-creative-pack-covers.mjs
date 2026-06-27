#!/usr/bin/env node
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const siteId = argValue("--site-id", "site_dreamshoot");
const fix = process.argv.includes("--fix");

async function main() {
  const packs = await prisma.creativePack.findMany({
    where: { siteId, status: "active" },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, name: true, imageUrl: true }
  });
  const missing = packs.filter((pack) => !pack.imageUrl);
  const imageMap = new Map();
  for (const pack of packs) {
    if (!pack.imageUrl) continue;
    imageMap.set(pack.imageUrl, [...(imageMap.get(pack.imageUrl) ?? []), pack]);
  }
  const duplicates = [...imageMap.entries()].filter(([, group]) => group.length > 1);

  if (fix) {
    for (const [, group] of duplicates) {
      for (const pack of group.slice(1)) {
        await prisma.creativePack.update({ where: { id: pack.id }, data: { imageUrl: null } });
      }
    }
  }

  const result = {
    ok: missing.length === 0 && duplicates.length === 0,
    siteId,
    activePacks: packs.length,
    missing: missing.map((pack) => ({ id: pack.id, name: pack.name })),
    duplicates: duplicates.map(([imageUrl, group]) => ({
      imageUrl,
      packs: group.map((pack) => ({ id: pack.id, name: pack.name })),
      fixClears: fix ? group.slice(1).map((pack) => ({ id: pack.id, name: pack.name })) : []
    }))
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok && !fix) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
