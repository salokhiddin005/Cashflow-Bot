"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Save, X, AlertTriangle, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import type { Category, TransactionWithCategory } from "@/lib/db/types";
import { formatDate, formatMoney } from "@/lib/format";
import { deleteTransactionAction, updateTransactionAction } from "@/app/actions";
import { Pill } from "./ui";
import { useConfirm } from "./confirm-dialog";

export function TransactionRow({
  tx,
  categories,
  anomaly,
}: {
  tx: TransactionWithCategory;
  categories: Category[];
  anomaly?: { reason: string };
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  if (editing) {
    return (
      <tr className="border-b border-[--color-border] bg-[--color-surface-2]/40">
        <td colSpan={4} className="px-5 py-3">
          <form
            action={(fd) => {
              setError(null);
              fd.set("id", String(tx.id));
              startTransition(async () => {
                try {
                  await updateTransactionAction(fd);
                  setEditing(false);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed to save");
                }
              });
            }}
            className="grid grid-cols-2 gap-2 md:grid-cols-[110px_120px_1fr_140px_auto]"
          >
            <select
              name="kind"
              defaultValue={tx.kind}
              className="h-9 rounded-md border border-[--color-border] bg-[--color-surface] px-2 text-sm focus-ring"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <input
              name="amount"
              type="number"
              min={1}
              defaultValue={tx.amount}
              className="h-9 rounded-md border border-[--color-border] bg-[--color-surface] px-2 text-sm tabular-nums focus-ring"
            />
            <select
              name="category_id"
              defaultValue={tx.category_id}
              className="h-9 rounded-md border border-[--color-border] bg-[--color-surface] px-2 text-sm focus-ring"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.kind === "income" ? "↑" : "↓"} {c.label_en}</option>
              ))}
            </select>
            <input
              name="occurred_on"
              type="date"
              defaultValue={tx.occurred_on}
              className="h-9 rounded-md border border-[--color-border] bg-[--color-surface] px-2 text-sm focus-ring"
            />
            <div className="col-span-2 md:col-span-1 flex items-center gap-1">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-9 items-center justify-center gap-1 rounded-md bg-[--color-brand] px-2.5 text-[12.5px] font-medium text-[--color-brand-foreground] hover:opacity-90"
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setError(null); }}
                className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-[--color-border] bg-[--color-surface] px-2.5 text-[12.5px] hover:bg-[--color-surface-2]"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
            <input
              name="note"
              defaultValue={tx.note ?? ""}
              placeholder="Note (optional)"
              className="col-span-2 md:col-span-5 h-9 rounded-md border border-[--color-border] bg-[--color-surface] px-2 text-sm focus-ring"
            />
            {error ? <div className="col-span-full text-xs text-red-600">{error}</div> : null}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="group border-b border-[--color-border] last:border-b-0 hover:bg-[--color-surface-2]/40">
      <td className="px-5 py-3 text-[13px] text-[--color-muted] tabular-nums whitespace-nowrap">{formatDate(tx.occurred_on)}</td>
      <td className="py-3 pr-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tx.category_color }} />
          <span className="text-[13.5px] font-medium">{tx.category_label_en}</span>
          {tx.source === "telegram" ? <Pill tone="accent">via bot</Pill> : null}
          {anomaly ? (
            <span title={anomaly.reason} className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" /> Unusual
            </span>
          ) : null}
        </div>
        {tx.note ? <div className="mt-0.5 text-[12px] text-[--color-muted]">{tx.note}</div> : null}
      </td>
      <td className="py-3 pr-3 text-right">
        <span
          className={clsx(
            "text-[13.5px] font-semibold tabular-nums",
            tx.kind === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
          )}
        >
          {tx.kind === "income" ? "+" : "−"} {formatMoney(tx.amount)}
        </span>
      </td>
      <td className="py-3 pr-5 text-right">
        <div className="inline-flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            onClick={() => setEditing(true)}
            className="group/btn inline-flex h-7 w-7 items-center justify-center rounded-md text-[--color-muted] transition-all duration-150 hover:scale-110 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95"
            aria-label="Edit"
          >
            <Pencil className="h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:rotate-12" />
          </button>
          <button
            type="button"
            aria-label="Delete"
            onClick={async () => {
              const ok = await confirm({
                title: "Delete this transaction?",
                description: `${tx.kind === "income" ? "+" : "−"} ${formatMoney(tx.amount)} · ${tx.category_label_en} · ${formatDate(tx.occurred_on)}. This can't be undone.`,
                confirmText: "Yes, delete",
                variant: "danger",
              });
              if (!ok) return;
              const fd = new FormData();
              fd.set("id", String(tx.id));
              startTransition(async () => {
                try { await deleteTransactionAction(fd); } catch {}
              });
            }}
            className="group/btn inline-flex h-7 w-7 items-center justify-center rounded-md text-[--color-muted] transition-all duration-150 hover:scale-110 hover:bg-red-500/10 hover:text-red-600 active:scale-95"
          >
            <Trash2 className="h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:-rotate-12" />
          </button>
        </div>
      </td>
    </tr>
  );
}
