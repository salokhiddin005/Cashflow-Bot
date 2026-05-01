import { z } from "zod";
import { Card, CardBody, EmptyState, PageHeader, Pill } from "@/components/ui";
import { TransactionFilters } from "@/components/transaction-filters";
import { TransactionRow } from "@/components/transaction-row";
import { Pagination } from "@/components/pagination";
import {
  countTransactions,
  listCategories,
  listTransactions,
  type TxFilter,
} from "@/lib/db/queries";
import { findAnomalies } from "@/lib/insights";
import { requireUserWorkspace } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import { ListTree } from "lucide-react";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 50;

const filterSchema = z.object({
  q: z.string().optional(),
  kind: z.enum(["income", "expense"]).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().optional(),
});

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspace } = await requireUserWorkspace();
  const sp = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const parsed = filterSchema.safeParse(flat);
  const f = parsed.success ? parsed.data : {};

  const page = f.page ?? 1;
  const filter: TxFilter = {
    q: f.q || undefined,
    kind: f.kind,
    categoryId: f.categoryId,
    from: f.from,
    to: f.to,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const [categories, txs, total] = await Promise.all([
    listCategories(workspace.id, { includeArchived: true }),
    listTransactions(workspace.id, filter),
    countTransactions(workspace.id, { ...filter, limit: undefined, offset: undefined }),
  ]);

  const anomalies = await findAnomalies(workspace.id, txs.map((t) => t.id));

  const filteredTotals = txs.reduce(
    (acc, t) => {
      if (t.kind === "income") acc.income += t.amount;
      else acc.expense += t.amount;
      return acc;
    },
    { income: 0, expense: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        subtitle={
          total === 0
            ? "Nothing logged yet."
            : `${total.toLocaleString()} total · this page sums ${formatMoney(filteredTotals.income)} in / ${formatMoney(filteredTotals.expense)} out`
        }
      >
        <Pill tone="neutral">{txs.length} on screen</Pill>
      </PageHeader>

      <Card>
        <div className="border-b border-[--color-border] px-5 py-3">
          <TransactionFilters categories={categories.filter((c) => !c.is_archived)} />
        </div>

        {total === 0 ? (
          <CardBody>
            <EmptyState
              icon={<ListTree className="h-6 w-6" />}
              title="No transactions match your filters"
              description="Try widening the date range or clearing the search box. New entries from the Telegram bot will appear here automatically."
            />
          </CardBody>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[--color-border] text-[11px] uppercase tracking-wide text-[--color-muted]">
                    <th className="px-5 py-2.5 font-medium">Date</th>
                    <th className="py-2.5 pr-3 font-medium">Category & note</th>
                    <th className="py-2.5 pr-3 text-right font-medium">Amount</th>
                    <th className="py-2.5 pr-5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {txs.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      categories={categories.filter((c) => !c.is_archived || c.id === tx.category_id)}
                      anomaly={anomalies.get(tx.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
          </>
        )}
      </Card>
    </div>
  );
}
