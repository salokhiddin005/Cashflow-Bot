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

// Run schema + seed once per process. Idempotent — schema uses IF NOT EXISTS,
// and the categories seed uses ON CONFLICT DO NOTHING.
async function migrateOnce(): Promise<void> {
  if (globalThis.__fmMigrated) return;
  // Set the flag BEFORE the seed call: seedDefaultCategories goes through
  // execute() which itself calls migrateOnce(). Without setting the flag
  // upfront, the seed re-enters migrate and deadlocks.
  globalThis.__fmMigrated = true;
  try {
    const schemaPath = path.join(process.cwd(), "src", "lib", "db", "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    await pool().query(schema);
    const { seedDefaultCategories } = await import("./seed");
    await seedDefaultCategories();
  } catch (e) {
    // If migration fails, allow a retry on the next call.
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
