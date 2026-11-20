#!/usr/bin/env node
// 清理已废弃的“域名 AI URL 使用范围”数据（2026-11-21）。
//
// 背景：AI 中转已对所有站点域名统一开放，域名不再单独保存白名单。
// 平台网关页的“域名 AI URL 使用范围”面板已移除，SiteDomain.allowedAiProviderIds
// 这份逐域名白名单不再被任何运行时读取。本脚本把非空数组清空，逐行 CAS
// （id + updatedAt）并在写入后回读；站点域名行本身（SiteDomain）保持不动，
// 它们是站点路由与 SEO 的当前关系数据。
//
// dry run:  node scripts/cleanup-platform-domain-ai-scope-2026-11-21.mjs --target=local
// apply:    node scripts/cleanup-platform-domain-ai-scope-2026-11-21.mjs --target=local --apply
// production apply 额外要求 --confirm=platform-domain-ai-scope-2026-11-21
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "platform-domain-ai-scope-2026-11-21";
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: hasArgument(`--confirm=${CONFIRM_NAME}`) });

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.siteDomain.findMany({
    where: { allowedAiProviderIds: { isEmpty: false } },
    select: { id: true, siteId: true, allowedAiProviderIds: true, updatedAt: true }
  });
  console.log(`target=${target} apply=${apply} 待清理域名记录: ${rows.length}`);
  for (const row of rows) {
    console.log(`  ${row.siteId} ${row.id} ids=[${row.allowedAiProviderIds.join(",")}] updatedAt=${row.updatedAt.toISOString()}`);
  }
  if (!apply || !rows.length) return;

  let cleared = 0;
  let skipped = 0;
  for (const row of rows) {
    const result = await prisma.siteDomain.updateMany({
      where: { id: row.id, updatedAt: row.updatedAt },
      data: { allowedAiProviderIds: [] }
    });
    if (result.count === 0) {
      skipped += 1;
      console.log(`  跳过（行已变化）: ${row.id}`);
      continue;
    }
    cleared += 1;
  }
  const remaining = await prisma.siteDomain.findMany({
    where: { allowedAiProviderIds: { isEmpty: false } },
    select: { id: true }
  });
  console.log(`已清理: ${cleared}，跳过: ${skipped}，回读后仍非空: ${remaining.length}`);
  if (skipped || remaining.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
