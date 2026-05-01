import { Pool } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";

declare global {
  // eslint-disable-next-line no-var
  var __fmPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __fmMigrated: boolean | undefined;
}

function pool(): Pool {
  if (!globalThis.__fmPool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
    globalThis.__fmPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return globalThis.__fmPool;
}

// Run schema once per process. Idempotent — schema uses IF NOT EXISTS, and
// the legacy single-tenant tables are dropped on first migration via a DO
// block in schema.sql. Per-workspace category seeding happens at workspace
// creation time, not here.
async function migrateOnce(): Promise<void> {
  if (globalThis.__fmMigrated) return;
  globalThis.__fmMigrated = true;
  try {
    const schemaPath = path.join(process.cwd(), "src", "lib", "db", "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    await pool().query(schema);
  } catch (e) {
    globalThis.__fmMigrated = false;
    throw e;
  }
}

// Public query helper. Lazily migrates the schema on first use.
export async function query<T = Record<string, unknown>>(
  sqlText: string,
  params: unknown[] = [],
): Promise<T[]> {
  await migrateOnce();
  const result = await pool().query({ text: sqlText, values: params });
  return result.rows as T[];
}

// Like query() but returns the first row or undefined.
export async function queryOne<T = Record<string, unknown>>(
  sqlText: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await query<T>(sqlText, params);
  return rows[0];
}

// Like query() but returns nothing — use for INSERT/UPDATE/DELETE without RETURNING.
export async function execute(sqlText: string, params: unknown[] = []): Promise<void> {
  await migrateOnce();
  await pool().query({ text: sqlText, values: params });
}
