import { query, queryOne } from "./db/client";
import { getWorkspace, totalsBetween } from "./db/queries";
import { subDays, format, parseISO } from "date-fns";

export type Runway = {
  currentBalance: number;
  trailing30Net: number;
  trailing30Burn: number;
  monthsOfRunway: number | null;
  burnRateMonthly: number;
  status: "profitable" | "healthy" | "tight" | "critical";
  asOfDate: string;
  isHistorical: boolean;
  beforeTracking: boolean;
};

const toNum = (v: unknown): number => (typeof v === "string" ? Number(v) : (v as number));

export async function computeRunway(workspaceId: number, opts: { asOfDate?: string } = {}): Promise<Runway> {
  const ws = await getWorkspace(workspaceId);
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const asOf = opts.asOfDate ?? todayStr;
  const isHistorical = asOf < todayStr;
  const beforeTracking = asOf < ws.starting_balance_at;

  const allTime = await queryOne<{ net: string }>(
    `SELECT COALESCE(SUM(CASE WHEN kind='income'  THEN amount END), 0)
          - COALESCE(SUM(CASE WHEN kind='expense' THEN amount END), 0) AS net
     FROM transactions WHERE workspace_id = $1 AND occurred_on <= $2`,
    [workspaceId, asOf],
  );
  const currentBalance = ws.starting_balance + toNum(allTime!.net);

  const from30 = format(subDays(parseISO(asOf), 29), "yyyy-MM-dd");
  const t30 = await totalsBetween(workspaceId, from30, asOf);
  const trailing30Net = t30.income - t30.expense;
  const burnRateMonthly = trailing30Net < 0 ? Math.abs(trailing30Net) : 0;
  const monthsOfRunway =
    burnRateMonthly === 0 ? null : Math.max(0, currentBalance) / burnRateMonthly;

  let status: Runway["status"] = "profitable";
  if (burnRateMonthly > 0) {
    if (monthsOfRunway === null || monthsOfRunway > 6) status = "healthy";
    else if (monthsOfRunway > 3) status = "tight";
    else status = "critical";
  }

  return {
    currentBalance,
    trailing30Net,
    trailing30Burn: burnRateMonthly,
    monthsOfRunway,
    burnRateMonthly,
    status,
    asOfDate: asOf,
    isHistorical,
    beforeTracking,
  };
}

// ────────────────────────────────────────────────────────────────────
// Daily series helpers — used by sparkline KPI cards and the activity heatmap
// ────────────────────────────────────────────────────────────────────

export type DailyPoint = { day: string; income: number; expense: number; net: number; count: number };

export async function dailySeriesFilled(workspaceId: number, fromIso: string, toIso: string): Promise<DailyPoint[]> {
  const rows = await query<{ day: string; income: string; expense: string; count: string }>(
    `SELECT occurred_on AS day,
      COALESCE(SUM(CASE WHEN kind='income'  THEN amount END), 0) AS income,
      COALESCE(SUM(CASE WHEN kind='expense' THEN amount END), 0) AS expense,
      COUNT(*) AS count
     FROM transactions
     WHERE workspace_id = $1 AND occurred_on BETWEEN $2 AND $3
     GROUP BY occurred_on`,
    [workspaceId, fromIso, toIso],
  );
  const map = new Map(rows.map((r) => [r.day, r]));
  const out: DailyPoint[] = [];
  let cur = parseISO(fromIso);
  const end = parseISO(toIso);
  while (cur <= end) {
    const key = format(cur, "yyyy-MM-dd");
    const r = map.get(key);
    out.push({
      day: key,
      income: r ? toNum(r.income) : 0,
      expense: r ? toNum(r.expense) : 0,
      net: r ? toNum(r.income) - toNum(r.expense) : 0,
      count: r ? toNum(r.count) : 0,
    });
    cur = new Date(cur.getTime() + 86_400_000);
  }
  return out;
}

export async function sparklineSeries(workspaceId: number, metric: "income" | "expense" | "net", days = 14): Promise<{ day: string; value: number }[]> {
  const today = new Date();
  const fromIso = format(new Date(today.getTime() - (days - 1) * 86_400_000), "yyyy-MM-dd");
  const toIso = format(today, "yyyy-MM-dd");
  const rows = await dailySeriesFilled(workspaceId, fromIso, toIso);
  return rows.map((p) => ({
    day: p.day,
    value: metric === "income" ? p.income : metric === "expense" ? p.expense : p.net,
  }));
}

// ────────────────────────────────────────────────────────────────────
// Recurring transaction detection
// ────────────────────────────────────────────────────────────────────

export type RecurringPattern = {
  category_id: number;
  category_key: string;
  category_label_en: string;
  category_color: string;
  kind: "income" | "expense";
  cadenceDays: number;
  cadenceLabel: "weekly" | "biweekly" | "monthly";
  averageAmount: number;
  occurrences: number;
  lastDate: string;
  nextExpected: string;
  daysUntilNext: number;
  confidence: "high" | "medium" | "low";
};

export async function detectRecurring(workspaceId: number): Promise<RecurringPattern[]> {
  const since = format(new Date(Date.now() - 180 * 86_400_000), "yyyy-MM-dd");
  type Row = {
    id: number;
    category_id: number;
    category_key: string;
    category_label_en: string;
    category_color: string;
    kind: "income" | "expense";
    amount: string;
    occurred_on: string;
  };
  const rawRows = await query<Row>(
    `SELECT t.id, t.category_id, c.key AS category_key, c.label_en AS category_label_en,
            c.color AS category_color, t.kind, t.amount, t.occurred_on
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.workspace_id = $1 AND t.occurred_on >= $2
     ORDER BY t.category_id, t.occurred_on ASC`,
    [workspaceId, since],
  );
  const rows = rawRows.map((r) => ({ ...r, category_id: toNum(r.category_id), amount: toNum(r.amount) }));

  const byCat = new Map<number, typeof rows>();
  for (const r of rows) {
    if (!byCat.has(r.category_id)) byCat.set(r.category_id, []);
    byCat.get(r.category_id)!.push(r);
  }

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const out: RecurringPattern[] = [];

  for (const [, txs] of byCat) {
    if (txs.length < 3) continue;
    const intervals: number[] = [];
    for (let i = 1; i < txs.length; i++) {
      const a = parseISO(txs[i - 1].occurred_on);
      const b = parseISO(txs[i].occurred_on);
      intervals.push(Math.round((b.getTime() - a.getTime()) / 86_400_000));
    }
    const median = intervals.slice().sort((a, b) => a - b)[Math.floor(intervals.length / 2)];
    if (median < 5 || median > 45) continue;

    const cadenceLabel: RecurringPattern["cadenceLabel"] =
      median <= 9 ? "weekly" : median <= 18 ? "biweekly" : "monthly";

    const meanI = intervals.reduce((s, n) => s + n, 0) / intervals.length;
    const variance = intervals.reduce((s, n) => s + (n - meanI) ** 2, 0) / intervals.length;
    const stddev = Math.sqrt(variance);
    const cv = stddev / meanI;
    const confidence: RecurringPattern["confidence"] =
      cv < 0.15 ? "high" : cv < 0.35 ? "medium" : "low";
    if (confidence === "low" && txs.length < 4) continue;

    const last = txs[txs.length - 1];
    const lastDate = parseISO(last.occurred_on);
    const nextExpected = new Date(lastDate.getTime() + median * 86_400_000);
    const daysUntilNext = Math.round((nextExpected.getTime() - parseISO(todayStr).getTime()) / 86_400_000);

    const avgRaw = txs.reduce((s, t) => s + t.amount, 0) / txs.length;
    const averageAmount = Math.round(avgRaw / 1000) * 1000;

    out.push({
      category_id: last.category_id,
      category_key: last.category_key,
      category_label_en: last.category_label_en,
      category_color: last.category_color,
      kind: last.kind,
      cadenceDays: median,
      cadenceLabel,
      averageAmount,
      occurrences: txs.length,
      lastDate: last.occurred_on,
      nextExpected: format(nextExpected, "yyyy-MM-dd"),
      daysUntilNext,
      confidence,
    });
  }

  out.sort((a, b) => a.daysUntilNext - b.daysUntilNext);
  return out;
}

// ────────────────────────────────────────────────────────────────────
// Cash-flow forecast
// ────────────────────────────────────────────────────────────────────

export type ForecastPoint = { day: string; balance: number; projected: boolean };

export async function balanceForecast(workspaceId: number, historyDays = 60, projectionDays = 30): Promise<ForecastPoint[]> {
  const ws = await getWorkspace(workspaceId);
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  const histStart = new Date(today.getTime() - (historyDays - 1) * 86_400_000);
  const histStartStr = format(histStart, "yyyy-MM-dd");

  const before = await queryOne<{ net: string }>(
    `SELECT COALESCE(SUM(CASE WHEN kind='income'  THEN amount END), 0)
          - COALESCE(SUM(CASE WHEN kind='expense' THEN amount END), 0) AS net
     FROM transactions WHERE workspace_id = $1 AND occurred_on < $2`,
    [workspaceId, histStartStr],
  );

  const histDaily = await dailySeriesFilled(workspaceId, histStartStr, todayStr);
  let running = ws.starting_balance + toNum(before!.net);
  const points: ForecastPoint[] = [];
  for (const p of histDaily) {
    running += p.income - p.expense;
    points.push({ day: p.day, balance: running, projected: false });
  }

  const recurring = await detectRecurring(workspaceId);
  const trailing30 = await totalsBetween(workspaceId, format(new Date(today.getTime() - 29 * 86_400_000), "yyyy-MM-dd"), todayStr);
  const trailing30Net = trailing30.income - trailing30.expense;
  const recurringInTrailing = recurring
    .filter((r) => r.confidence !== "low")
    .reduce((s, r) => {
      const occursPer30 = 30 / r.cadenceDays;
      const net = r.kind === "income" ? r.averageAmount : -r.averageAmount;
      return s + net * occursPer30;
    }, 0);
  const nonRecurringNetPerDay = (trailing30Net - recurringInTrailing) / 30;

  const recurringByDate = new Map<string, number>();
  for (const r of recurring) {
    if (r.confidence === "low") continue;
    let next = parseISO(r.nextExpected);
    while (next.getTime() <= today.getTime() + projectionDays * 86_400_000) {
      const key = format(next, "yyyy-MM-dd");
      const prev = recurringByDate.get(key) ?? 0;
      recurringByDate.set(key, prev + (r.kind === "income" ? r.averageAmount : -r.averageAmount));
      next = new Date(next.getTime() + r.cadenceDays * 86_400_000);
    }
  }

  for (let i = 1; i <= projectionDays; i++) {
    const d = new Date(today.getTime() + i * 86_400_000);
    const key = format(d, "yyyy-MM-dd");
    running += nonRecurringNetPerDay;
    running += recurringByDate.get(key) ?? 0;
    points.push({ day: key, balance: Math.round(running), projected: true });
  }
  return points;
}

export type AnomalyFlag = {
  transactionId: number;
  reason: string;
  multiple: number;
};

export async function findAnomalies(workspaceId: number, transactionIds: number[]): Promise<Map<number, AnomalyFlag>> {
  if (transactionIds.length === 0) return new Map();
  const placeholders = transactionIds.map((_, i) => `$${i + 2}`).join(",");
  const txs = await query<{ id: number; kind: "income" | "expense"; amount: string; category_id: number; occurred_on: string }>(
    `SELECT id, kind, amount, category_id, occurred_on FROM transactions WHERE workspace_id = $1 AND id IN (${placeholders})`,
    [workspaceId, ...transactionIds],
  );

  const out = new Map<number, AnomalyFlag>();
  for (const tx of txs) {
    if (tx.kind !== "expense") continue;
    const since = format(subDays(new Date(tx.occurred_on), 90), "yyyy-MM-dd");
    const peers = await query<{ amount: string }>(
      `SELECT amount FROM transactions
       WHERE workspace_id = $1 AND category_id = $2 AND kind = 'expense'
         AND occurred_on >= $3 AND occurred_on < $4
       ORDER BY amount`,
      [workspaceId, toNum(tx.category_id), since, tx.occurred_on],
    );
    if (peers.length < 4) continue;
    const sorted = peers.map((p) => toNum(p.amount));
    const median = sorted[Math.floor(sorted.length / 2)];
    if (median <= 0) continue;
    const txAmount = toNum(tx.amount);
    const multiple = txAmount / median;
    if (multiple >= 3) {
      const txId = toNum(tx.id);
      out.set(txId, {
        transactionId: txId,
        reason: `Unusually large for this category (${multiple.toFixed(1)}× the 90-day median)`,
        multiple,
      });
    }
  }
  return out;
}
