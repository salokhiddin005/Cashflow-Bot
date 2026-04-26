import { clsx } from "clsx";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "./ui";
import { Sparkline } from "./sparkline";
import { formatMoney, pctDelta } from "@/lib/format";

export function KpiCard({
  label,
  current,
  previous,
  intent = "neutral",
  hint,
  trailing,
  spark,
}: {
  label: string;
  current: number;
  previous: number;
  intent?: "income" | "expense" | "net" | "neutral";
  hint?: ReactNode;
  trailing?: ReactNode;
  spark?: { day: string; value: number }[];
}) {
  const delta = pctDelta(current, previous);
  // For "expense", up is bad. For "income"/"net", up is good.
  const goodWhenUp = intent !== "expense";
  const tone =
    delta.sign === "flat"
      ? "text-[--color-muted]"
      : (delta.sign === "up") === goodWhenUp
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";

  const sparkColor =
    intent === "income" ? "#10b981"
    : intent === "expense" ? "#ef4444"
    : intent === "net" && current < 0 ? "#ef4444"
    : intent === "net" ? "#10b981"
    : "#4f46e5";

  const Arrow = delta.sign === "up" ? ArrowUpRight : delta.sign === "down" ? ArrowDownRight : Minus;

  return (
    <Card className="px-5 py-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[12px] font-medium uppercase tracking-wide text-[--color-muted]">{label}</div>
        {trailing}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="text-2xl font-semibold tabular-nums tracking-tight">
          {formatMoney(current)}
        </div>
        {spark && spark.length >= 2 ? (
          <div className="-mb-1 shrink-0">
            <Sparkline data={spark} color={sparkColor} width={96} height={32} />
          </div>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[12.5px] text-[--color-muted]">
        <span className={clsx("inline-flex items-center gap-0.5", tone)}>
          <Arrow className="h-3.5 w-3.5" />
          {delta.sign === "flat" ? "no change" : `${delta.value.toFixed(0)}%`}
        </span>
        <span>vs. previous period</span>
      </div>
      {hint ? <div className="mt-2 text-[12px] text-[--color-muted]">{hint}</div> : null}
    </Card>
  );
}
