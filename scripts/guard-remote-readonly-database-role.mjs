#!/usr/bin/env node
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget, buildTunneledReadonlyDatabaseUrl } from "./lib/database-target.mjs";

process.env.DINGYUE_ENV = "remote-readonly";
process.env.DATABASE_TARGET = "remote-readonly";
process.env.DATABASE_URL = buildTunneledReadonlyDatabaseUrl(process.env.REMOTE_DB_READONLY_DATABASE_URL);
assertDatabaseTarget({ expectedTarget: "remote-readonly" });

const prisma = new PrismaClient();
try {
  const [result] = await prisma.$queryRawUnsafe(`
    select
      current_user,
      current_setting('transaction_read_only') as transaction_read_only,
      has_table_privilege(current_user, '"ThemePage"', 'SELECT') as can_select,
      has_table_privilege(current_user, '"ThemePage"', 'INSERT') as can_insert,
      has_table_privilege(current_user, '"ThemePage"', 'UPDATE') as can_update,
      has_table_privilege(current_user, '"ThemePage"', 'DELETE') as can_delete
  `);
  assert.equal(result.transaction_read_only, "on", "remote-readonly role must default to read-only transactions");
  assert.equal(result.can_select, true, "remote-readonly role must read ThemePage");
  assert.equal(result.can_insert, false, "remote-readonly role must not insert ThemePage");
  assert.equal(result.can_update, false, "remote-readonly role must not update ThemePage");
  assert.equal(result.can_delete, false, "remote-readonly role must not delete ThemePage");
  console.log(JSON.stringify({ role: result.current_user, transactionReadOnly: true, ThemePage: "SELECT only" }, null, 2));
} finally {
  await prisma.$disconnect();
}
