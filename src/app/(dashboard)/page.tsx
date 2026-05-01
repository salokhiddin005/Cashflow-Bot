import { PeriodTabs } from "@/components/period-tabs";
import { Hero } from "@/components/hero";
import { KpiCard } from "@/components/kpi-card";
import { RunwayCard } from "@/components/runway-card";
import { QuickAdd } from "@/components/quick-add";
import { RecentTransactions } from "@/components/recent-transactions";
import { Onboarding } from "@/components/onboarding";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { RecurringPanel } from "@/components/recurring-panel";
import { Card, CardBody, CardHeader } from "@/components/ui";
import {
  countTransactions,
  listCategories,
  totalsBetween,
} from "@/lib/db/queries";
import { loggingStreak, sparklineSeries } from "@/lib/insights";
import { resolvePeriod, type PeriodKey } from "@/lib/dates";
import { requireUserWorkspace } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED: PeriodKey[] = ["this_month", "last_30", "last_7", "ytd"];

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { user, workspace } = await requireUserWorkspace();
  const sp = await searchParams;
  const periodKey = (ALLOWED.includes(sp.period as PeriodKey) ? sp.period : "this_month") as PeriodKey;
  const period = resolvePeriod(periodKey);

  const totalCount = await countTransactions(workspace.id);
  const categories = await listCategories(workspace.id);

  if (totalCount === 0) {
    return (
      <div className="space-y-8">
        <Onboarding />
        <div className="grid gap-6 lg:grid-cols-3" id="quick-add-section">
          <div className="lg:col-span-2">
            <RecentTransactions />
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span>⚡</span> Quick add
              </div>
              <div className="mt-0.5 text-[12px] text-[--color-muted]">
                Log a transaction without opening Telegram.
              </div>
            </CardHeader>
            <CardBody>
              <QuickAdd categories={categories} />
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  // Run all read-only queries in parallel so first-byte stays fast.
  const [cur, prev, incomeSpark, expenseSpark, netSpark, streak] = await Promise.all([
    totalsBetween(workspace.id, period.from, period.to),
    totalsBetween(workspace.id, period.prev.from, period.prev.to),
    sparklineSeries(workspace.id, "income",  14),
    sparklineSeries(workspace.id, "expense", 14),
    sparklineSeries(workspace.id, "net",     14),
    loggingStreak(workspace.id),
  ]);

  // First-name-ish identity for the greeting. Fall back to the workspace
  // name if no user identifier is friendly enough.
  const identity =
    user.tg_username ? `@${user.tg_username}`
    : user.email     ? user.email.split("@")[0]
    : null;

  return (
    <div className="space-y-6">
      <Hero
        workspaceName={workspace.name}
        identity={identity}
        current={cur}
        previous={prev}
        streak={streak}
        periodLabel={`${period.label} · vs. ${period.prev.label}`}
      >
        <PeriodTabs current={period.key} />
      </Hero>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Income"   current={cur.income}  previous={prev.income}  intent="income"  spark={incomeSpark} />
        <KpiCard label="Expenses" current={cur.expense} previous={prev.expense} intent="expense" spark={expenseSpark} />
        <KpiCard label="Net"      current={cur.net}     previous={prev.net}     intent="net"     spark={netSpark} />
        <RunwayCard />
      </div>

      <ActivityHeatmap weeks={13} />

      <div className="grid gap-6 lg:grid-cols-3" id="quick-add-section">
        <div className="lg:col-span-2 space-y-6">
          <RecentTransactions />
          <RecurringPanel />
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span>⚡</span> Quick add
            </div>
            <div className="mt-0.5 text-[12px] text-[--color-muted]">
              Log a transaction without opening Telegram.
            </div>
          </CardHeader>
          <CardBody>
            <QuickAdd categories={categories} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
