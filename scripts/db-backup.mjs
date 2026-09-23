import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required for production backups");
const outputDir = process.env.BACKUP_DIR?.trim() || "artifacts/backups";
mkdirSync(outputDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const output = join(outputDir, "kanban-" + stamp + ".sql");
execFileSync("pg_dump", ["--no-owner", "--no-privileges", "--format=plain", "--file", output, databaseUrl], { stdio: "inherit" });
console.log("Backup written to " + output);
