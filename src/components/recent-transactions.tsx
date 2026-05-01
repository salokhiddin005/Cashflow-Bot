import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { Card, CardBody, CardHeader, Pill } from "./ui";
import { listTransactions } from "@/lib/db/queries";
import { requireUserWorkspace } from "@/lib/auth/session";
import { formatDate, formatMoney } from "@/lib/format";

// Friendly relative time. Beats the raw ISO date for "what's new" scanning.
function relativeDate(iso: string): string {
  const today = new Date();
  const d = new Date(iso + "T00:00:00");
  const days = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)   return `${days}d ago`;
  return formatDate(iso);
}

export async function RecentTransactions() {
  const { workspace } = await requireUserWorkspace();
  const txs = await listTransactions(workspace.id, { limit: 8 });
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[14px]">📋</span>
          <div className="text-sm font-semibold">Recent activity</div>
        </div>
        <Link
          href="/transactions"
          className="inline-flex items-center gap-1 text-[12.5px] text-[--color-muted] transition hover:text-[--color-foreground]"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardBody className="px-0 py-0">
        {txs.length === 0 ? (
          <EmptyRecent />
        ) : (
          <ul className="divide-y divide-[--color-border]">
            {txs.map((t) => (
              <li
                key={t.id}
                className="group flex items-center gap-3 px-5 py-3 transition hover:bg-[--color-surface-2]/60"
              >
                {/* Category dot — bumped to a small ring so it has presence */}
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[15px]"
                  style={{ background: `${t.category_color}22`, color: t.category_color }}
                  aria-hidden
                >
                  {t.kind === "income" ? "↗" : "↘"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-medium">{t.category_label_en}</span>
                    {t.source === "telegram" ? <Pill tone="accent">via bot</Pill> : null}
                  </div>
                  {t.note ? (
                    <div className="truncate text-[12px] text-[--color-muted]">{t.note}</div>
                  ) : (
                    <div className="text-[12px] text-[--color-muted]">{relativeDate(t.occurred_on)}</div>
                  )}
                </div>
                <div className="text-right">
                  <div
                    className={`text-[14px] font-semibold tabular-nums transition group-hover:scale-[1.02] ${
                      t.kind === "income"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {t.kind === "income" ? "+" : "−"} {formatMoney(t.amount)}
                  </div>
                  {t.note ? (
                    <div className="text-[11px] text-[--color-muted]">{relativeDate(t.occurred_on)}</div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function EmptyRecent() {
  return (
    <div className="flex flex-col items-center px-5 py-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-amber-500/15 to-rose-500/15 text-amber-700 dark:text-amber-300">
        <Inbox className="h-6 w-6 animate-float" />
      </div>
      <div className="mt-3 text-[14px] font-semibold">Nothing logged yet</div>
      <div className="mt-1 max-w-xs text-[12.5px] text-[--color-muted]">
        Type to your bot or use Quick Add — entries land here within seconds. ✨
      </div>
    </div>
  );
}
