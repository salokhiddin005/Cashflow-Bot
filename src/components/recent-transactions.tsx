import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState, Pill } from "./ui";
import { listTransactions } from "@/lib/db/queries";
import { requireUserWorkspace } from "@/lib/auth/session";
import { formatDate, formatMoney } from "@/lib/format";

export async function RecentTransactions() {
  const { workspace } = await requireUserWorkspace();
  const txs = await listTransactions(workspace.id, { limit: 8 });
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div className="text-sm font-semibold">Recent activity</div>
        <Link href="/transactions" className="inline-flex items-center gap-1 text-[12.5px] text-[--color-muted] hover:text-[--color-foreground]">
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardBody className="px-0 py-0">
        {txs.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              title="No transactions yet"
              description="Use the quick-add form on the right or send a message to the Telegram bot."
            />
          </div>
        ) : (
          <ul className="divide-y divide-[--color-border]">
            {txs.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: t.category_color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-medium">{t.category_label_en}</span>
                    {t.source === "telegram" ? <Pill tone="accent">via bot</Pill> : null}
                  </div>
                  {t.note ? (
                    <div className="truncate text-[12px] text-[--color-muted]">{t.note}</div>
                  ) : (
                    <div className="text-[12px] text-[--color-muted]">{formatDate(t.occurred_on)}</div>
                  )}
                </div>
                <div className="text-right">
                  <div
                    className={`text-[13.5px] font-semibold tabular-nums ${
                      t.kind === "income"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {t.kind === "income" ? "+" : "−"} {formatMoney(t.amount)}
                  </div>
                  <div className="text-[11px] text-[--color-muted]">{formatDate(t.occurred_on)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
