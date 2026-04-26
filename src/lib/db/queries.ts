import { execute, query, queryOne } from "./client";
import type {
  Category,
  Kind,
  Source,
  TelegramUser,
  Transaction,
  TransactionWithCategory,
  Workspace,
} from "./types";

// Postgres returns BIGINT and SUM/COUNT as strings (because JS Numbers can't
// represent the full 64-bit range). For UZS amounts and row counts the values
// fit comfortably in Number, so we coerce on read.
const toNum = (v: unknown): number => (typeof v === "string" ? Number(v) : (v as number));

function fixCategory(r: Category): Category {
  return { ...r, is_archived: toNum(r.is_archived) as 0 | 1, is_system: toNum(r.is_system) as 0 | 1, sort_order: toNum(r.sort_order) };
}
function fixWorkspace(r: Workspace): Workspace {
  return { ...r, starting_balance: toNum(r.starting_balance) };
}
function fixTransaction(r: TransactionWithCategory): TransactionWithCategory {
  return {
    ...r,
    amount: toNum(r.amount),
    original_amount: r.original_amount == null ? null : toNum(r.original_amount),
    fx_rate: r.fx_rate == null ? null : Number(r.fx_rate),
    category_id: toNum(r.category_id),
    telegram_user_id: r.telegram_user_id == null ? null : toNum(r.telegram_user_id),
  };
}

// ───────── Workspace ─────────
export async function getWorkspace(): Promise<Workspace> {
  const r = await queryOne<Workspace>("SELECT * FROM workspace WHERE id = 1");
  return fixWorkspace(r!);
}

export async function updateWorkspace(patch: Partial<Pick<Workspace, "name" | "base_currency" | "starting_balance" | "starting_balance_at" | "timezone">>) {
  const cur = await getWorkspace();
  const next = { ...cur, ...patch };
  await execute(
    `UPDATE workspace SET name=$1, base_currency=$2, starting_balance=$3,
      starting_balance_at=$4, timezone=$5 WHERE id = 1`,
    [next.name, next.base_currency, next.starting_balance, next.starting_balance_at, next.timezone],
  );
  return next;
}

// ───────── Categories ─────────
export async function listCategories(opts: { kind?: Kind; includeArchived?: boolean } = {}): Promise<Category[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.kind) {
    params.push(opts.kind);
    where.push(`kind = $${params.length}`);
  }
  if (!opts.includeArchived) where.push("is_archived = 0");
  const sql = `SELECT * FROM categories ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY kind, sort_order, label_en`;
  const rows = await query<Category>(sql, params);
  return rows.map(fixCategory);
}

export async function getCategoryByKey(key: string): Promise<Category | undefined> {
  const r = await queryOne<Category>("SELECT * FROM categories WHERE key = $1", [key]);
  return r ? fixCategory(r) : undefined;
}

export async function getCategoryById(id: number): Promise<Category | undefined> {
  const r = await queryOne<Category>("SELECT * FROM categories WHERE id = $1", [id]);
  return r ? fixCategory(r) : undefined;
}

// Generate a unique snake_case key from a free-form name.
export async function generateUniqueCategoryKey(name: string): Promise<string> {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30) || "custom";
  let candidate = base;
  let n = 2;
  while (await getCategoryByKey(candidate)) {
    candidate = `${base}_${n++}`;
    if (n > 99) throw new Error("Could not generate a unique category key");
  }
  return candidate;
}

export async function createCategory(input: {
  key: string;
  kind: Kind;
  label_uz: string;
  label_ru: string;
  label_en: string;
  color?: string;
  icon?: string;
}): Promise<Category> {
  const r = await queryOne<Category>(
    `INSERT INTO categories (key, kind, label_uz, label_ru, label_en, color, icon)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [input.key, input.kind, input.label_uz, input.label_ru, input.label_en, input.color ?? "#64748b", input.icon ?? "circle"],
  );
  return fixCategory(r!);
}

export async function updateCategory(id: number, patch: Partial<Pick<Category, "label_uz" | "label_ru" | "label_en" | "color" | "icon" | "is_archived" | "sort_order">>): Promise<Category> {
  const cur = await getCategoryById(id);
  if (!cur) throw new Error("Category not found");
  const next = { ...cur, ...patch };
  await execute(
    `UPDATE categories SET label_uz=$1, label_ru=$2, label_en=$3,
      color=$4, icon=$5, is_archived=$6, sort_order=$7 WHERE id = $8`,
    [next.label_uz, next.label_ru, next.label_en, next.color, next.icon, next.is_archived, next.sort_order, id],
  );
  return (await getCategoryById(id))!;
}

export async function deleteCategory(id: number): Promise<void> {
  const cur = await getCategoryById(id);
  if (!cur) return;
  if (cur.is_system) {
    await updateCategory(id, { is_archived: 1 });
    return;
  }
  // Refuse hard-delete if any transactions reference it; archive instead.
  const used = await queryOne("SELECT 1 AS x FROM transactions WHERE category_id = $1 LIMIT 1", [id]);
  if (used) {
    await updateCategory(id, { is_archived: 1 });
    return;
  }
  await execute("DELETE FROM categories WHERE id = $1", [id]);
}

// ───────── Telegram users ─────────
export async function upsertTelegramUser(u: {
  telegram_id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  language_code?: string | null;
}): Promise<TelegramUser> {
  await execute(
    `INSERT INTO telegram_users (telegram_id, username, first_name, last_name, language_code)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (telegram_id) DO UPDATE SET
       username      = EXCLUDED.username,
       first_name    = EXCLUDED.first_name,
       last_name     = EXCLUDED.last_name,
       language_code = COALESCE(EXCLUDED.language_code, telegram_users.language_code)`,
    [u.telegram_id, u.username ?? null, u.first_name ?? null, u.last_name ?? null, u.language_code ?? null],
  );
  const r = await queryOne<TelegramUser>(
    "SELECT * FROM telegram_users WHERE telegram_id = $1",
    [u.telegram_id],
  );
  return { ...r!, id: toNum(r!.id), telegram_id: toNum(r!.telegram_id) };
}

export async function setUserLanguage(telegram_id: number, lang: "uz" | "ru" | "en"): Promise<void> {
  await execute("UPDATE telegram_users SET language_code = $1 WHERE telegram_id = $2", [lang, telegram_id]);
}

export async function getUserLanguage(telegram_id: number): Promise<"uz" | "ru" | "en" | null> {
  const r = await queryOne<{ language_code: string | null }>(
    "SELECT language_code FROM telegram_users WHERE telegram_id = $1",
    [telegram_id],
  );
  const v = r?.language_code;
  if (v === "uz" || v === "ru" || v === "en") return v;
  return null;
}

// ───────── Transactions ─────────
const TX_SELECT = `
  SELECT t.*,
    c.key      AS category_key,
    c.label_en AS category_label_en,
    c.label_uz AS category_label_uz,
    c.label_ru AS category_label_ru,
    c.color    AS category_color,
    c.icon     AS category_icon
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
`;

export async function createTransaction(input: {
  kind: Kind;
  amount: number;
  currency?: string;
  original_amount?: number | null;
  original_currency?: string | null;
  fx_rate?: number | null;
  category_id: number;
  occurred_on: string;
  note?: string | null;
  source?: Source;
  telegram_user_id?: number | null;
}): Promise<TransactionWithCategory> {
  const r = await queryOne<{ id: number }>(
    `INSERT INTO transactions
     (kind, amount, currency, original_amount, original_currency, fx_rate, category_id, occurred_on, note, source, telegram_user_id)
     VALUES ($1, $2, COALESCE($3, 'UZS'), $4, $5, $6, $7, $8, $9, COALESCE($10, 'web'), $11)
     RETURNING id`,
    [
      input.kind,
      input.amount,
      input.currency ?? null,
      input.original_amount ?? null,
      input.original_currency ?? null,
      input.fx_rate ?? null,
      input.category_id,
      input.occurred_on,
      input.note ?? null,
      input.source ?? null,
      input.telegram_user_id ?? null,
    ],
  );
  return (await getTransaction(toNum(r!.id)))!;
}

export async function getTransaction(id: number): Promise<TransactionWithCategory | undefined> {
  const r = await queryOne<TransactionWithCategory>(`${TX_SELECT} WHERE t.id = $1`, [id]);
  return r ? fixTransaction(r) : undefined;
}

export type TxFilter = {
  from?: string;
  to?: string;
  kind?: Kind;
  categoryId?: number;
  q?: string;
  limit?: number;
  offset?: number;
};

function buildTxWhere(f: TxFilter): { where: string; params: unknown[] } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.from) { params.push(f.from);       where.push(`t.occurred_on >= $${params.length}`); }
  if (f.to)   { params.push(f.to);         where.push(`t.occurred_on <= $${params.length}`); }
  if (f.kind) { params.push(f.kind);       where.push(`t.kind = $${params.length}`); }
  if (f.categoryId) { params.push(f.categoryId); where.push(`t.category_id = $${params.length}`); }
  if (f.q) {
    params.push(`%${f.q}%`);
    const i = params.length;
    where.push(`(t.note ILIKE $${i} OR c.label_en ILIKE $${i} OR c.label_uz ILIKE $${i} OR c.label_ru ILIKE $${i})`);
  }
  return { where: where.length ? "WHERE " + where.join(" AND ") : "", params };
}

export async function listTransactions(f: TxFilter = {}): Promise<TransactionWithCategory[]> {
  const { where, params } = buildTxWhere(f);
  const limit  = Math.min(Math.max(f.limit ?? 100, 1), 500);
  const offset = Math.max(f.offset ?? 0, 0);
  params.push(limit);  const limitIdx = params.length;
  params.push(offset); const offsetIdx = params.length;
  const sql = `${TX_SELECT} ${where} ORDER BY t.occurred_on DESC, t.id DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
  const rows = await query<TransactionWithCategory>(sql, params);
  return rows.map(fixTransaction);
}

export async function countTransactions(f: TxFilter = {}): Promise<number> {
  const { where, params } = buildTxWhere(f);
  const r = await queryOne<{ n: string }>(
    `SELECT COUNT(*) AS n FROM transactions t JOIN categories c ON c.id = t.category_id ${where}`,
    params,
  );
  return toNum(r!.n);
}

export async function updateTransaction(
  id: number,
  patch: Partial<Pick<Transaction, "kind" | "amount" | "currency" | "original_amount" | "original_currency" | "fx_rate" | "category_id" | "occurred_on" | "note">>,
): Promise<TransactionWithCategory> {
  const cur = await getTransaction(id);
  if (!cur) throw new Error("Transaction not found");
  const next = { ...cur, ...patch };
  await execute(
    `UPDATE transactions SET kind=$1, amount=$2, currency=$3,
      original_amount=$4, original_currency=$5, fx_rate=$6,
      category_id=$7, occurred_on=$8, note=$9,
      updated_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') WHERE id=$10`,
    [
      next.kind, next.amount, next.currency,
      next.original_amount, next.original_currency, next.fx_rate,
      next.category_id, next.occurred_on, next.note,
      id,
    ],
  );
  return (await getTransaction(id))!;
}

export async function deleteTransaction(id: number): Promise<void> {
  await execute("DELETE FROM transactions WHERE id = $1", [id]);
}

// ───────── Aggregates ─────────
export type Totals = { income: number; expense: number; net: number; count: number };

export async function totalsBetween(from: string, to: string): Promise<Totals> {
  const r = await queryOne<{ income: string; expense: string; count: string }>(
    `SELECT
      COALESCE(SUM(CASE WHEN kind='income'  THEN amount END), 0) AS income,
      COALESCE(SUM(CASE WHEN kind='expense' THEN amount END), 0) AS expense,
      COUNT(*) AS count
     FROM transactions WHERE occurred_on BETWEEN $1 AND $2`,
    [from, to],
  );
  const income = toNum(r!.income);
  const expense = toNum(r!.expense);
  return { income, expense, net: income - expense, count: toNum(r!.count) };
}

export async function categoryTotalBetween(categoryId: number, from: string, to: string): Promise<{ total: number; count: number }> {
  const r = await queryOne<{ total: string; count: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
     FROM transactions WHERE category_id = $1 AND occurred_on BETWEEN $2 AND $3`,
    [categoryId, from, to],
  );
  return { total: toNum(r!.total), count: toNum(r!.count) };
}

export type DailySeriesPoint = { day: string; income: number; expense: number };

export async function dailySeries(from: string, to: string): Promise<DailySeriesPoint[]> {
  const rows = await query<{ day: string; income: string; expense: string }>(
    `SELECT occurred_on AS day,
       COALESCE(SUM(CASE WHEN kind='income'  THEN amount END), 0) AS income,
       COALESCE(SUM(CASE WHEN kind='expense' THEN amount END), 0) AS expense
     FROM transactions
     WHERE occurred_on BETWEEN $1 AND $2
     GROUP BY occurred_on
     ORDER BY occurred_on ASC`,
    [from, to],
  );
  return rows.map((r) => ({ day: r.day, income: toNum(r.income), expense: toNum(r.expense) }));
}

export type CategoryBreakdownRow = {
  category_id: number;
  key: string;
  label_en: string;
  color: string;
  total: number;
  share: number;
};

export async function categoryBreakdown(kind: Kind, from: string, to: string): Promise<CategoryBreakdownRow[]> {
  const rows = await query<{ category_id: number; key: string; label_en: string; color: string; total: string }>(
    `SELECT c.id AS category_id, c.key, c.label_en, c.color,
            COALESCE(SUM(t.amount), 0) AS total
     FROM categories c
     LEFT JOIN transactions t ON t.category_id = c.id AND t.kind = $1 AND t.occurred_on BETWEEN $2 AND $3
     WHERE c.kind = $1
     GROUP BY c.id
     HAVING COALESCE(SUM(t.amount), 0) > 0
     ORDER BY total DESC`,
    [kind, from, to],
  );
  const normalized = rows.map((r) => ({
    category_id: toNum(r.category_id),
    key: r.key,
    label_en: r.label_en,
    color: r.color,
    total: toNum(r.total),
  }));
  const sum = normalized.reduce((acc, r) => acc + r.total, 0) || 1;
  return normalized.map((r) => ({ ...r, share: r.total / sum }));
}

// Net-worth-style cumulative balance series (starting balance + cumulative net).
export async function balanceSeries(from: string, to: string): Promise<{ day: string; balance: number }[]> {
  const ws = await getWorkspace();
  const before = await queryOne<{ net: string }>(
    `SELECT COALESCE(SUM(CASE WHEN kind='income'  THEN amount END), 0)
          - COALESCE(SUM(CASE WHEN kind='expense' THEN amount END), 0) AS net
     FROM transactions WHERE occurred_on < $1`,
    [from],
  );
  const startBalance = ws.starting_balance + toNum(before!.net);

  const series = await dailySeries(from, to);
  let running = startBalance;
  return series.map((p) => {
    running += p.income - p.expense;
    return { day: p.day, balance: running };
  });
}
