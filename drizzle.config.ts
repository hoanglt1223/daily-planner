import { defineConfig } from 'drizzle-kit';
import { readFileSync } from 'node:fs';

// Load .env.local before drizzle-kit reads process.env (drizzle-kit only auto-loads .env)
try {
  const raw = readFileSync('.env.local', 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const [, k, v] = m;
    if (process.env[k]) continue;
    process.env[k] = v.replace(/^['"]|['"]$/g, '');
  }
} catch { /* no .env.local */ }

export default defineConfig({
  schema: './server/lib/db/schema.ts',
  out: './server/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
