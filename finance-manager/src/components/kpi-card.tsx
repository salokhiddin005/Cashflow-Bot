import { clsx } from "clsx";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { Sparkline } from "./sparkline";
import { CountUp } from "./count-up";
import { pctDelta } from "@/lib/format";

// Pick a humanlike phrase for the delta. Beats a bare percentage at
// communicating what's actually happening — "best week in months" is more
// useful than "+18%" for the at-a-glance scan.
function deltaPhrase(pct: number, sign: "up" | "down" | "flat", goodWhenUp: boolean): string {
  if (sign === "flat") return "holding steady";
  const good = (sign === "up") === goodWhenUp;
  const big = pct >= 50;
  const med = pct >= 20;
  if (sign === "up") {
    if (big) return good ? "up sharply" : "climbing fast";
    if (med) return good ? "trending up" : "creeping up";
    return good ? "up a bit" : "up slightly";
  }
  if (big) return good ? "way down" : "dropped sharply";
  if (med) return good ? "easing back" : "noticeably down";
  return good ? "down a touch" : "down a bit";
}

export function KpiCard({
  label,
  current,
  previous,
  intent = "neutral",
  hint,
  trailing,
  spark,
  emoji,
}: {
  label: string;
  current: number;
  previous: number;
  intent?: "income" | "expense" | "net" | "neutral";
  hint?: ReactNode;
  trailing?: ReactNode;
  spark?: { day: string; value: number }[];
  emoji?: string;
}) {
  const delta = pctDelta(current, previous);
  const goodWhenUp = intent !== "expense";
  const isGood = delta.sign === "flat" ? null : (delta.sign === "up") === goodWhenUp;
  const tone =
    isGood === null  ? "text-[--color-muted]"
    : isGood         ? "text-emerald-600 dark:text-emerald-400"
                     : "text-red-600 dark:text-red-400";

  const sparkColor =
    intent === "income" ? "#10b981"
    : intent === "expense" ? "#f43f5e"
    : intent === "net" && current < 0 ? "#f43f5e"
    : intent === "net" ? "#10b981"
    : "#8b5cf6";

  const wash =
    intent === "income"  ? "bg-wash-emerald"
    : intent === "expense" ? "bg-wash-rose"
    : intent === "net"     ? "bg-wash-indigo"
                           : "";

  // Big, friendly emoji for each KPI — sets the mood without being cartoony.
  const fallbackEmoji =
    intent === "income"  ? "📈"
    : intent === "expense" ? "💸"
    : intent === "net"     ? "✨"
                           : "•";

  const Arrow = delta.sign === "up" ? ArrowUpRight : delta.sign === "down" ? ArrowDownRight : Minus;
  const phrase = deltaPhrase(Math.abs(delta.value), delta.sign, goodWhenUp);

  return (
    <div
      className={clsx(
        "hover-lift relative overflow-hidden rounded-xl border border-[--color-border] bg-[--color-surface] px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]",
        wash,
      )}
    >
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wide text-[--color-muted]">
          <span className="text-[14px] leading-none">{emoji ?? fallbackEmoji}</span>
          <span>{label}</span>
        </div>
        {trailing}
      </div>
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <CountUp
          to={current}
          className="text-[28px] font-semibold leading-none tabular-nums tracking-tight"
        />
        {spark && spark.length >= 2 ? (
          <div className="-mb-1 shrink-0">
            <Sparkline data={spark} color={sparkColor} width={96} height={32} />
          </div>
        ) : null}
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-[12.5px]">
        <span className={clsx("inline-flex items-center gap-0.5 font-medium", tone)}>
          <Arrow className="h-3.5 w-3.5" />
          {delta.sign === "flat" ? "no change" : `${delta.value.toFixed(0)}%`}
        </span>
        <span className="text-[--color-muted]">— {phrase}</span>
      </div>
      {hint ? <div className="mt-2 text-[12px] text-[--color-muted]">{hint}</div> : null}
    </div>
  );
}
