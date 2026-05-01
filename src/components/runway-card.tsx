import { Card } from "./ui";
import { formatMoney } from "@/lib/format";
import { computeRunway } from "@/lib/insights";
import { requireUserWorkspace } from "@/lib/auth/session";
import { TrendingDown, ShieldCheck } from "lucide-react";

export async function RunwayCard() {
  const { workspace } = await requireUserWorkspace();
  const r = await computeRunway(workspace.id);
  const status = r.status;
  const tone =
    status === "profitable" ? "text-emerald-600 dark:text-emerald-400"
    : status === "healthy"  ? "text-emerald-600 dark:text-emerald-400"
    : status === "tight"    ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400";
  const headline =
    status === "profitable"
      ? "Profitable — building cash"
      : r.monthsOfRunway === null
        ? "—"
        : r.monthsOfRunway >= 24
          ? "24+ months of runway"
          : `${r.monthsOfRunway.toFixed(1)} months of runway`;
  const Icon = status === "profitable" || status === "healthy" ? ShieldCheck : TrendingDown;

  return (
    <Card className="px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-medium uppercase tracking-wide text-[--color-muted]">Cash position</div>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
        {formatMoney(r.currentBalance)}
      </div>
      <div className={`mt-1.5 text-[12.5px] font-medium ${tone}`}>{headline}</div>
      <div className="mt-1 text-[12px] text-[--color-muted]">
        {r.burnRateMonthly > 0
          ? `Burning ~${formatMoney(r.burnRateMonthly)} / 30 days`
          : `Net +${formatMoney(r.trailing30Net)} over the last 30 days`}
      </div>
    </Card>
  );
}
