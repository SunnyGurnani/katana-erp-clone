/**
 * Regenerates the baseline migration SQL from the current Prisma schema.
 * Run from repo root: node apps/api/scripts/generate-initial-migration-sql.mjs
 * Or from apps/api: node scripts/generate-initial-migration-sql.mjs
 *
 * Requires: pnpm install (prisma CLI available via npx)
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, '..');
const migrationDir = join(apiRoot, 'prisma', 'migrations', '20250326120000_init');
const outFile = join(migrationDir, 'migration.sql');

const sql = execSync(
  'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
  { cwd: apiRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
);

if (!existsSync(migrationDir)) {
  mkdirSync(migrationDir, { recursive: true });
}
writeFileSync(outFile, sql, 'utf8');
console.log(`Wrote ${outFile}`);
