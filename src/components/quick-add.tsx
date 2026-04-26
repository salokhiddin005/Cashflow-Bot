"use client";

import { useState, useTransition } from "react";
import { addTransactionAction } from "@/app/actions";
import { Button, Input, Select, Textarea } from "./ui";
import type { Category } from "@/lib/db/types";
import { todayISO } from "@/lib/dates";
import { Plus, Loader2 } from "lucide-react";

export function QuickAdd({ categories }: { categories: Category[] }) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const visible = categories.filter((c) => c.kind === kind);

  return (
    <form
      action={(fd) => {
        setError(null);
        fd.set("kind", kind);
        startTransition(async () => {
          try {
            await addTransactionAction(fd);
            (document.getElementById("quick-add") as HTMLFormElement | null)?.reset();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save");
          }
        });
      }}
      id="quick-add"
      className="space-y-3"
    >
      <div className="inline-flex rounded-lg border border-[--color-border] bg-[--color-surface] p-1 text-[12.5px] shadow-sm">
        {(["expense", "income"] as const).map((k) => {
          const active = kind === k;
          return (
            <button
              type="button"
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-md px-3 py-1.5 capitalize transition-all duration-200 ${
                active
                  ? k === "income"
                    ? "bg-gradient-to-br from-emerald-500 to-teal-500 font-medium text-white shadow-[0_2px_8px_-2px_rgba(16,185,129,0.5)]"
                    : "bg-gradient-to-br from-rose-500 to-red-500 font-medium text-white shadow-[0_2px_8px_-2px_rgba(244,63,94,0.5)]"
                  : "text-[--color-muted] hover:bg-[--color-surface-2] hover:text-[--color-foreground]"
              }`}
            >
              {k === "income" ? "💰 " : "💸 "}
              {k}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[--color-muted]">Amount (UZS)</label>
          <Input
            name="amount"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="0"
            required
            className="tabular-nums"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[--color-muted]">Date</label>
          <Input name="occurred_on" type="date" defaultValue={todayISO()} required />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[--color-muted]">Category</label>
        <Select name="category_id" required defaultValue="">
          <option value="" disabled>Choose a category</option>
          {visible.map((c) => (
            <option key={c.id} value={c.id}>{c.label_en}</option>
          ))}
        </Select>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[--color-muted]">Note (optional)</label>
        <Textarea name="note" placeholder="e.g. Payment from Akbar Logistics" />
      </div>

      {error ? <div className="text-xs text-red-600">{error}</div> : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Plus className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" />}
        Save transaction
      </Button>
    </form>
  );
}
