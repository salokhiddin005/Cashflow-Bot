import { format, parseISO } from "date-fns";

export function formatMoney(amount: number, currency = "UZS"): string {
  if (currency === "UZS") {
    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: 0,
    }).format(amount) + " so'm";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMoneyCompact(amount: number, currency = "UZS"): string {
  const abs = Math.abs(amount);
  let v: string;
  if (abs >= 1_000_000_000) v = (amount / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "") + "B";
  else if (abs >= 1_000_000) v = (amount / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  else if (abs >= 10_000) v = (amount / 1_000).toFixed(0) + "K";
  else v = String(amount);
  return currency === "UZS" ? `${v} so'm` : `${currency} ${v}`;
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), "d MMM yyyy");
}

export function formatDateRange(from: string, to: string): string {
  const f = parseISO(from);
  const t = parseISO(to);
  if (f.getFullYear() === t.getFullYear()) {
    return `${format(f, "d MMM")} – ${format(t, "d MMM yyyy")}`;
  }
  return `${format(f, "d MMM yyyy")} – ${format(t, "d MMM yyyy")}`;
}

export function pctDelta(curr: number, prev: number): { value: number; sign: "up" | "down" | "flat" } {
  if (prev === 0 && curr === 0) return { value: 0, sign: "flat" };
  if (prev === 0) return { value: 100, sign: "up" };
  const v = ((curr - prev) / Math.abs(prev)) * 100;
  return { value: Math.abs(v), sign: v > 0.1 ? "up" : v < -0.1 ? "down" : "flat" };
}
