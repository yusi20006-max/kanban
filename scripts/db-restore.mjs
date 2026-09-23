import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const databaseUrl = process.env.DATABASE_URL?.trim();
const file = process.argv[2];
if (!databaseUrl) throw new Error("DATABASE_URL is required for restore");
if (!file || !existsSync(file)) throw new Error("Usage: DATABASE_URL=... node scripts/db-restore.mjs <backup.sql>");
if (process.argv[3] !== "--confirm") throw new Error("Restore is destructive. Re-run with --confirm.");
execFileSync("psql", ["--set=ON_ERROR_STOP=1", databaseUrl, "-f", file], { stdio: "inherit" });
console.log("Restore completed");
