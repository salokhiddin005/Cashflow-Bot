import { notFound } from "next/navigation";
import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardBody, EmptyState, PageHeader, Pill } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { query } from "@/lib/db/client";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// tg_username allow-list. Anyone signed in but not on this list gets a 404 —
// the page is admin-only and shouldn't even acknowledge it exists.
const ADMIN_TG_USERNAMES = ["Saloxiddin_005"];

type Totals = {
  total_users: string;
  users_with_transactions: string;
  active_7d: string;
  active_30d: string;
};

type Row = {
  telegram_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language_code: string | null;
  first_seen: string;
  last_seen_at: string;
  tx_count: string;
  income_count: string;
  expense_count: string;
  total_income: string;
  total_expense: string;
  last_tx_at: string | null;
};

// Match the schema's ISO format (no fractional seconds): "2026-05-05T10:35:00Z".
function nDaysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().replace(/\.\d+Z$/, "Z");
}

export default async function AdminUsersPage() {
  const me = await requireUser();
  if (!me.tg_username || !ADMIN_TG_USERNAMES.includes(me.tg_username)) {
    notFound();
  }

  const [totalsRows, userRows] = await Promise.all([
    query<Totals>(
      `SELECT
         (SELECT COUNT(*) FROM telegram_users)                          AS total_users,
         (SELECT COUNT(DISTINCT telegram_user_id) FROM transactions
            WHERE telegram_user_id IS NOT NULL)                         AS users_with_transactions,
         (SELECT COUNT(*) FROM telegram_users WHERE last_seen_at > $1)  AS active_7d,
         (SELECT COUNT(*) FROM telegram_users WHERE last_seen_at > $2)  AS active_30d`,
      [nDaysAgoIso(7), nDaysAgoIso(30)],
    ),
    query<Row>(
      `SELECT
         tu.telegram_id::text                                                   AS telegram_id,
         tu.username,
         tu.first_name,
         tu.last_name,
         tu.language_code,
         tu.created_at                                                          AS first_seen,
         tu.last_seen_at,
         COUNT(t.id)::text                                                      AS tx_count,
         (COUNT(*) FILTER (WHERE t.kind = 'income'))::text                      AS income_count,
         (COUNT(*) FILTER (WHERE t.kind = 'expense'))::text                     AS expense_count,
         COALESCE(SUM(CASE WHEN t.kind = 'income'  THEN t.amount END), 0)::text AS total_income,
         COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN t.amount END), 0)::text AS total_expense,
         MAX(t.created_at)                                                      AS last_tx_at
       FROM telegram_users tu
       LEFT JOIN transactions t ON t.telegram_user_id = tu.id
       GROUP BY tu.id
       ORDER BY COUNT(t.id) DESC, tu.last_seen_at DESC`,
    ),
  ]);

  const totals = totalsRows[0] ?? {
    total_users: "0",
    users_with_transactions: "0",
    active_7d: "0",
    active_30d: "0",
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Bot Users" subtitle="Who's using the Telegram bot, and how often.">
        <Pill tone="accent">Admin</Pill>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total users" value={totals.total_users} />
        <StatCard
          label="Logged a transaction"
          value={totals.users_with_transactions}
          hint={`of ${totals.total_users} total`}
        />
        <StatCard label="Active in 7 days" value={totals.active_7d} />
        <StatCard label="Active in 30 days" value={totals.active_30d} />
      </div>

      <Card>
        {userRows.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No bot users yet"
              description="Send /start to your bot from a Telegram account and it'll appear here."
            />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[--color-border] bg-[--color-surface-2] text-left text-[12px] uppercase tracking-wide text-[--color-muted]">
                <tr>
                  <Th>User</Th>
                  <Th align="right">Tx</Th>
                  <Th align="right">In</Th>
                  <Th align="right">Out</Th>
                  <Th align="right">Income</Th>
                  <Th align="right">Expense</Th>
                  <Th>Last activity</Th>
                </tr>
              </thead>
              <tbody>
                {userRows.map((u) => {
                  const txCount = Number(u.tx_count);
                  const incomeCount = Number(u.income_count);
                  const expenseCount = Number(u.expense_count);
                  const incomeTotal = Number(u.total_income);
                  const expenseTotal = Number(u.total_expense);
                  const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ") || "—";
                  const lastAt = u.last_tx_at ?? u.last_seen_at;
                  const profileUrl = u.username ? `https://t.me/${u.username}` : null;
                  return (
                    <tr
                      key={u.telegram_id}
                      className="border-b border-[--color-border] last:border-0 hover:bg-[--color-surface-2]/40"
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium">
                          {profileUrl ? (
                            <Link
                              href={profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              @{u.username}
                            </Link>
                          ) : (
                            <span className="text-[--color-muted]">no username</span>
                          )}
                        </div>
                        <div className="text-[12px] text-[--color-muted]">
                          {fullName} · ID {u.telegram_id}
                          {u.language_code ? ` · ${u.language_code}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums align-top">
                        {txCount > 0 ? txCount : <span className="text-[--color-muted]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums align-top text-emerald-600 dark:text-emerald-400">
                        {incomeCount > 0 ? incomeCount : ""}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums align-top text-rose-600 dark:text-rose-400">
                        {expenseCount > 0 ? expenseCount : ""}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums align-top">
                        {incomeTotal > 0 ? formatMoney(incomeTotal) : ""}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums align-top">
                        {expenseTotal > 0 ? formatMoney(expenseTotal) : ""}
                      </td>
                      <td className="px-4 py-3 align-top text-[12px] text-[--color-muted]">
                        {formatRelative(lastAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="px-5 py-4">
      <div className="text-[12px] font-medium uppercase tracking-wide text-[--color-muted]">
        {label}
      </div>
      <div className="mt-2 text-[28px] font-semibold leading-none tabular-nums tracking-tight">
        {value}
      </div>
      {hint ? <div className="mt-2 text-[12px] text-[--color-muted]">{hint}</div> : null}
    </Card>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function formatRelative(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const sec = Math.floor((Date.now() - then) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
