import { Flame, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { formatMoney, pctDelta } from "@/lib/format";
import type { Totals } from "@/lib/db/queries";

// Time-of-day greeting localised to the workspace's vibe rather than the
// strict locale — keeps the warmth we want without an i18n round-trip.
function greeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

// One-line vibe check based on this period vs. the previous one. Beats a
// bare percentage by telling the owner what to feel about the number.
function vibeCheck(cur: Totals, prev: Totals): { text: string; tone: "good" | "bad" | "flat" } {
  const incomeDelta = pctDelta(cur.income, prev.income);
  const netDelta = pctDelta(cur.net, prev.net);
  if (cur.count === 0 && prev.count === 0) {
    return { text: "Quiet so far — log your first transaction to see this come alive.", tone: "flat" };
  }
  if (cur.net > 0 && cur.net > prev.net && incomeDelta.sign === "up" && incomeDelta.value >= 20) {
    return { text: `Income up ${incomeDelta.value.toFixed(0)}% — strong stretch ✨`, tone: "good" };
  }
  if (cur.net < 0 && cur.net < prev.net) {
    return { text: `Net is down ${Math.abs(netDelta.value).toFixed(0)}% — worth a look at expenses 👀`, tone: "bad" };
  }
  if (cur.net >= 0 && prev.net >= 0 && Math.abs(netDelta.value) < 10) {
    return { text: "Holding steady — predictable cash flow is underrated 🧘", tone: "flat" };
  }
  if (cur.net > prev.net) {
    return { text: `Net ${formatMoney(cur.net - prev.net)} better than last period 📈`, tone: "good" };
  }
  return { text: `Spending outpaced income — keep an eye on it 🪙`, tone: "bad" };
}

export function Hero({
  workspaceName,
  identity,
  current,
  previous,
  streak,
  periodLabel,
  children,
}: {
  workspaceName: string;
  identity: string | null;
  current: Totals;
  previous: Totals;
  streak: number;
  periodLabel: string;
  children?: React.ReactNode;
}) {
  const vibe = vibeCheck(current, previous);
  const Icon = vibe.tone === "good" ? TrendingUp : vibe.tone === "bad" ? TrendingDown : Sparkles;
  const iconTone =
    vibe.tone === "good" ? "text-emerald-600 dark:text-emerald-400"
    : vibe.tone === "bad" ? "text-rose-600 dark:text-rose-400"
    : "text-indigo-600 dark:text-indigo-400";

  // Pick a friendly first-line tag from the workspace name so the greeting
  // feels personal even when we don't know a real first name.
  const tag = identity ?? workspaceName;

  return (
    <div className="bg-hero relative overflow-hidden rounded-2xl border border-[--color-border] px-6 py-7 lg:px-8 lg:py-9">
      {/* Decorative accent — warm sunset-orange glow that complements the
          cream-to-amber hero band underneath. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-60 blur-2xl"
        style={{ background: "radial-gradient(circle at center, rgba(251,146,60,0.65), transparent 60%)" }}
      />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px] font-medium text-[--color-muted]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{periodLabel}</span>
            {streak > 0 ? <StreakChip days={streak} /> : null}
          </div>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight lg:text-4xl">
            {greeting()},{" "}
            <span className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 bg-clip-text text-transparent">
              {tag}
            </span>
          </h1>
          <div className={`mt-2 inline-flex items-center gap-1.5 text-[14px] ${iconTone}`}>
            <Icon className="h-4 w-4" />
            <span className="text-[--color-foreground]">{vibe.text}</span>
          </div>
        </div>
        {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
      </div>
    </div>
  );
}

function StreakChip({ days }: { days: number }) {
  // Slightly different copy at milestone counts so the chip rewards
  // sustained effort without being shouty.
  const label =
    days >= 30 ? `${days}-day streak — legend status`
    : days >= 14 ? `${days}-day streak`
    : days >= 7  ? `${days}-day streak — nice rhythm`
    : `${days}-day streak`;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300">
      <Flame className="h-3 w-3 animate-flicker" />
      {label}
    </span>
  );
}
