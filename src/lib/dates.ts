import { addDays, format, parseISO, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";

export type PeriodKey = "this_month" | "last_30" | "last_7" | "ytd" | "custom";

export type Period = {
  key: PeriodKey;
  from: string; // YYYY-MM-DD
  to: string;
  label: string;
  prev: { from: string; to: string; label: string };
};

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function todayISO(): string {
  return iso(new Date());
}

export function resolvePeriod(key: PeriodKey, custom?: { from: string; to: string }): Period {
  const today = new Date();
  if (key === "this_month") {
    const from = startOfMonth(today);
    const to = endOfMonth(today);
    const prevFrom = startOfMonth(subMonths(today, 1));
    const prevTo = endOfMonth(subMonths(today, 1));
    return {
      key, from: iso(from), to: iso(to),
      label: format(today, "MMMM yyyy"),
      prev: { from: iso(prevFrom), to: iso(prevTo), label: format(subMonths(today, 1), "MMMM yyyy") },
    };
  }
  if (key === "last_30") {
    const to = today;
    const from = subDays(today, 29);
    const prevTo = subDays(from, 1);
    const prevFrom = subDays(prevTo, 29);
    return {
      key, from: iso(from), to: iso(to),
      label: "Last 30 days",
      prev: { from: iso(prevFrom), to: iso(prevTo), label: "Previous 30 days" },
    };
  }
  if (key === "last_7") {
    const to = today;
    const from = subDays(today, 6);
    const prevTo = subDays(from, 1);
    const prevFrom = subDays(prevTo, 6);
    return {
      key, from: iso(from), to: iso(to),
      label: "Last 7 days",
      prev: { from: iso(prevFrom), to: iso(prevTo), label: "Previous 7 days" },
    };
  }
  if (key === "ytd") {
    const from = new Date(today.getFullYear(), 0, 1);
    const to = today;
    const prevFrom = new Date(today.getFullYear() - 1, 0, 1);
    const prevTo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    return {
      key, from: iso(from), to: iso(to),
      label: `${today.getFullYear()} YTD`,
      prev: { from: iso(prevFrom), to: iso(prevTo), label: `${today.getFullYear() - 1} YTD` },
    };
  }
  // custom
  const from = custom?.from ?? iso(subDays(today, 29));
  const to = custom?.to ?? iso(today);
  const f = parseISO(from);
  const t = parseISO(to);
  const days = Math.max(1, Math.round((t.getTime() - f.getTime()) / 86_400_000) + 1);
  const prevTo = subDays(f, 1);
  const prevFrom = subDays(prevTo, days - 1);
  return {
    key, from, to,
    label: `${format(f, "d MMM yyyy")} – ${format(t, "d MMM yyyy")}`,
    prev: { from: iso(prevFrom), to: iso(prevTo), label: "Previous period" },
  };
}

export function eachDayBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = parseISO(from);
  const end = parseISO(to);
  while (cur <= end) {
    out.push(iso(cur));
    cur = addDays(cur, 1);
  }
  return out;
}
