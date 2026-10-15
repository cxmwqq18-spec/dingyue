import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
// Import only local database/session/storage settings, never provider configuration.
const envKeys = new Set(['DATABASE_URL', 'DATABASE_TARGET', 'DINGYUE_ENV', 'CSRF_SECRET', 'NEXTAUTH_SECRET', 'AUTH_SECRET', 'CUSTOMER_ASSET_STORAGE_ROOT', 'CUSTOMER_ASSET_WRITE_BASE_URL', 'CUSTOMER_ASSET_SHARED_BASE_URL']);
export async function loadCloneAcceptanceEnv() {
  for (const filename of ['.env.local', '.env']) {
    try { await fs.access(filename); } catch { continue; }
    const lines = createInterface({ input: createReadStream(filename), crlfDelay: Infinity });
    for await (const line of lines) {
      const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=/);
      if (!match || !envKeys.has(match[1]) || process.env[match[1]] !== undefined) continue;
      let value = line.slice(line.indexOf('=') + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  }
}
