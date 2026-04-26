import { z } from "zod";
import {
  categoryBreakdown,
  countTransactions,
  totalsBetween,
} from "@/lib/db/queries";
import { resolvePeriod, type PeriodKey } from "@/lib/dates";
import { computeRunway } from "@/lib/insights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED: PeriodKey[] = ["this_month", "last_30", "last_7", "ytd"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const periodParam = z
    .enum(["this_month", "last_30", "last_7", "ytd"] as const)
    .catch("this_month")
    .parse(url.searchParams.get("period") ?? "this_month");
  if (!ALLOWED.includes(periodParam)) return Response.json({ error: "invalid period" }, { status: 400 });

  const period = resolvePeriod(periodParam);
  const [cur, prev, expenseFull, incomeFull, runway, total] = await Promise.all([
    totalsBetween(period.from, period.to),
    totalsBetween(period.prev.from, period.prev.to),
    categoryBreakdown("expense", period.from, period.to),
    categoryBreakdown("income",  period.from, period.to),
    computeRunway(),
    countTransactions(),
  ]);
  const expense = expenseFull.slice(0, 12);
  const income  = incomeFull.slice(0, 12);

  return Response.json({
    period: { key: period.key, label: period.label, from: period.from, to: period.to },
    previous: { label: period.prev.label, from: period.prev.from, to: period.prev.to, ...prev },
    current: cur,
    breakdown: { income, expense },
    runway,
    transaction_count: total,
  });
}
