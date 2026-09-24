// @ts-check
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { pendingMigrations } from "./migration-plan.mjs";

const { Pool } = pg;

let readinessPromise;

/**
 * Check the preview database contract without relying on ViteDevServer.ssrLoadModule.
 * PreviewServer intentionally exposes only the HTTP middleware surface.
 *
 * @param {string} root
 * @returns {Promise<"neon"|"pglite">}
 */
export function previewDatabaseReady(root) {
  readinessPromise ??= probeDatabase(root).catch((error) => {
    readinessPromise = undefined;
    throw error;
  });
  return readinessPromise;
}

/** @param {string} root */
async function probeDatabase(root) {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await pool.query("select 1");
      return "neon";
    } finally {
      await pool.end();
    }
  }

  const pgLite = new PGlite({
    parsers: {
      20: Number,
      1082: (value) => value,
      1186: (value) => value,
    },
  });

  try {
    await pgLite.waitReady;
    await pgLite.exec(
      "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
    );

    const migrationsDir = join(root, "migrations");
    let paths = [];
    try {
      paths = (await readdir(migrationsDir)).filter((path) => path.endsWith(".sql"));
    } catch {
      paths = [];
    }

    const appliedRows = await pgLite.query("select name from _migrations");
    const applied = appliedRows.rows.map((row) => String(row.name));

    for (const { name, path } of pendingMigrations(paths, applied)) {
      const sql = await readFile(join(migrationsDir, path), "utf8");
      await pgLite.transaction(async (tx) => {
        await tx.exec(sql);
        await tx.query("insert into _migrations (name) values ($1)", [name]);
      });
    }

    return "pglite";
  } finally {
    await pgLite.close();
  }
}
