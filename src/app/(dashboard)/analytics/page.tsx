import { Card, CardBody, CardHeader, EmptyState, PageHeader, Pill } from "@/components/ui";
import { PeriodTabs } from "@/components/period-tabs";
import {
  BalanceChart,
  CategoryBars,
  CategoryDonut,
  TrendChart,
} from "@/components/analytics-charts";
import { ForecastChart } from "@/components/forecast-chart";
import { RecurringPanel } from "@/components/recurring-panel";
import {
  balanceSeries,
  categoryBreakdown,
  countTransactions,
  dailySeries,
  totalsBetween,
} from "@/lib/db/queries";
import { balanceForecast } from "@/lib/insights";
import { requireUserWorkspace } from "@/lib/auth/session";
import { eachDayBetween, resolvePeriod, type PeriodKey } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { BarChart3 } from "lucide-react";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED: PeriodKey[] = ["this_month", "last_30", "last_7", "ytd"];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { workspace } = await requireUserWorkspace();
  const sp = await searchParams;
  const periodKey = (ALLOWED.includes(sp.period as PeriodKey) ? sp.period : "last_30") as PeriodKey;
  const period = resolvePeriod(periodKey);

  if ((await countTransactions(workspace.id)) === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" subtitle="Charts and breakdowns will appear once you log a few transactions." />
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title="Not enough data yet"
          description="Add a few transactions on the Overview page or via the Telegram bot — analytics need at least one entry to draw."
        />
      </div>
    );
  }

  // Run all read-only queries in parallel for first-byte performance.
  const [totals, series, expenseBreakdown, incomeBreakdown, balance, forecast] = await Promise.all([
    totalsBetween(workspace.id, period.from, period.to),
    dailySeries(workspace.id, period.from, period.to),
    categoryBreakdown(workspace.id, "expense", period.from, period.to),
    categoryBreakdown(workspace.id, "income",  period.from, period.to),
    balanceSeries(workspace.id, period.from, period.to),
    balanceForecast(workspace.id, 60, 30),
  ]);

  // Pad missing days with zeros so the chart line is continuous.
  const seriesMap = new Map(series.map((p) => [p.day, p]));
  const filled = eachDayBetween(period.from, period.to).map((day) =>
    seriesMap.get(day) ?? { day, income: 0, expense: 0 },
  );

  const expenseSlices = expenseBreakdown.map((r) => ({ name: r.label_en, value: r.total, color: r.color }));
  const incomeSlices  = incomeBreakdown.map((r) => ({ name: r.label_en, value: r.total, color: r.color }));

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle={`${period.label}`}>
        <PeriodTabs current={period.key} />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Income"   value={totals.income}  tone="positive" />
        <Stat label="Expenses" value={totals.expense} tone="negative" />
        <Stat label="Net"      value={totals.net}     tone={totals.net >= 0 ? "positive" : "negative"} signed />
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="text-sm font-semibold">Income vs. expenses</div>
          <Pill tone="neutral">daily</Pill>
        </CardHeader>
        <CardBody>
          <TrendChart data={filled} />
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="text-sm font-semibold">Where the money went</div>
            <Pill tone="neutral">expense by category</Pill>
          </CardHeader>
          <CardBody>
            <div className="grid gap-4 md:grid-cols-2">
              <CategoryDonut data={expenseSlices} />
              <BreakdownLegend rows={expenseBreakdown} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="text-sm font-semibold">Where the money came from</div>
            <Pill tone="neutral">income by category</Pill>
          </CardHeader>
          <CardBody>
            <div className="grid gap-4 md:grid-cols-2">
              <CategoryDonut data={incomeSlices} />
              <BreakdownLegend rows={incomeBreakdown} />
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="text-sm font-semibold">Cash balance over time</div>
          <Pill tone="accent">starting balance + cumulative net</Pill>
        </CardHeader>
        <CardBody>
          <BalanceChart data={balance} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Cash-flow forecast</div>
            <div className="mt-0.5 text-[12px] text-[--color-muted]">
              Last 60 days plus a 30-day projection — uses detected recurring transactions and your trailing burn rate.
            </div>
          </div>
          <Pill tone="accent">projected</Pill>
        </CardHeader>
        <CardBody>
          <ForecastChart data={forecast} />
        </CardBody>
      </Card>

      <RecurringPanel limit={8} />

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Top expense categories</div>
        </CardHeader>
        <CardBody>
          <CategoryBars data={expenseSlices.slice(0, 8)} />
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  signed,
}: {
  label: string;
  value: number;
  tone: "positive" | "negative" | "neutral";
  signed?: boolean;
}) {
  const color =
    tone === "positive" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "negative" ? "text-red-600 dark:text-red-400"
    : "";
  const display = signed && value > 0 ? `+${formatMoney(value)}` : formatMoney(value);
  return (
    <Card className="px-5 py-4">
      <div className="text-[12px] font-medium uppercase tracking-wide text-[--color-muted]">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${color}`}>{display}</div>
    </Card>
  );
}

function BreakdownLegend({
  rows,
}: {
  rows: { key: string; label_en: string; color: string; total: number; share: number }[];
}) {
  if (rows.length === 0) {
    return <div className="flex h-full items-center text-[12.5px] text-[--color-muted]">No data for this period</div>;
  }
  return (
    <ul className="flex flex-col gap-2 text-[13px]">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />
          <span className="flex-1 truncate">{r.label_en}</span>
          <span className="tabular-nums text-[--color-muted]">{(r.share * 100).toFixed(0)}%</span>
          <span className="w-32 text-right tabular-nums font-medium">{formatMoney(r.total)}</span>
        </li>
      ))}
    </ul>
  );
}
