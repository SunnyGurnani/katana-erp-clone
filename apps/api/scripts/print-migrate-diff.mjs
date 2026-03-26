import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
const prismaCli = path.join(apiRoot, "node_modules", "prisma", "build", "index.js");

const r = spawnSync(
  process.execPath,
  [
    prismaCli,
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
  ],
  { cwd: apiRoot, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 },
);

if (r.error) throw r.error;
if (r.status !== 0) {
  process.stderr.write(r.stderr || "");
  process.exit(r.status ?? 1);
}
process.stdout.write(r.stdout || "");
