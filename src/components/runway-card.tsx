import { formatMoney } from "@/lib/format";
import { computeRunway } from "@/lib/insights";
import { requireUserWorkspace } from "@/lib/auth/session";
import { TrendingDown, ShieldCheck } from "lucide-react";
import { CountUp } from "./count-up";

// Same hover-lift + wash treatment as KpiCard so the row reads as a unified
// quartet rather than three KPIs + one orphan.
export async function RunwayCard() {
  const { workspace } = await requireUserWorkspace();
  const r = await computeRunway(workspace.id);
  const status = r.status;
  const tone =
    status === "profitable" ? "text-emerald-600 dark:text-emerald-400"
    : status === "healthy"  ? "text-emerald-600 dark:text-emerald-400"
    : status === "tight"    ? "text-amber-600 dark:text-amber-400"
                            : "text-rose-600 dark:text-rose-400";
  const wash =
    status === "profitable" || status === "healthy" ? "bg-wash-emerald"
    : status === "tight" ? "bg-wash-amber"
                         : "bg-wash-rose";
  const headline =
    status === "profitable"
      ? "Profitable — building cash 🎉"
      : r.monthsOfRunway === null
        ? "—"
        : r.monthsOfRunway >= 24
          ? "24+ months of runway"
          : `${r.monthsOfRunway.toFixed(1)} months of runway`;
  const Icon = status === "profitable" || status === "healthy" ? ShieldCheck : TrendingDown;

  return (
    <div className={`hover-lift relative overflow-hidden rounded-xl border border-[--color-border] bg-[--color-surface] px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] ${wash}`}>
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wide text-[--color-muted]">
          <span className="text-[14px] leading-none">💰</span>
          <span>Cash position</span>
        </div>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <CountUp
        to={r.currentBalance}
        className="mt-2.5 block text-[28px] font-semibold leading-none tabular-nums tracking-tight"
      />
      <div className={`mt-2.5 text-[12.5px] font-medium ${tone}`}>{headline}</div>
      <div className="mt-1 text-[12px] text-[--color-muted]">
        {r.burnRateMonthly > 0
          ? `Burning ~${formatMoney(r.burnRateMonthly)} / 30 days`
          : `Net +${formatMoney(r.trailing30Net)} over the last 30 days`}
      </div>
    </div>
  );
}
