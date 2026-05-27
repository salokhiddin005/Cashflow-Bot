"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input, Select, Button } from "./ui";
import type { Category } from "@/lib/db/types";
import { Search, X } from "lucide-react";

export function TransactionFilters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const initialQ = params.get("q") ?? "";
  const [q, setQ] = useState(initialQ);

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    startTransition(() => router.replace(`/transactions?${next.toString()}`));
  }

  // Live, debounced search — fires 300ms after the user stops typing.
  // Skips the first render so we don't push a route on mount.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const t = setTimeout(() => {
      update({ q: q.trim() || undefined });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const kind = params.get("kind") ?? "";
  const categoryId = params.get("categoryId") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Search" className="min-w-[220px] flex-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[--color-muted-2]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search note or category…"
            className="pl-8"
            aria-label="Search transactions"
          />
        </div>
      </Field>

      <Field label="Type">
        <Select value={kind} onChange={(e) => update({ kind: e.target.value || undefined })}>
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </Select>
      </Field>

      <Field label="Category">
        <Select value={categoryId} onChange={(e) => update({ categoryId: e.target.value || undefined })}>
          <option value="">All categories</option>
          <optgroup label="Income">
            {categories.filter((c) => c.kind === "income").map((c) => (
              <option key={c.id} value={c.id}>{c.label_en}</option>
            ))}
          </optgroup>
          <optgroup label="Expense">
            {categories.filter((c) => c.kind === "expense").map((c) => (
              <option key={c.id} value={c.id}>{c.label_en}</option>
            ))}
          </optgroup>
        </Select>
      </Field>

      <Field label="From">
        <Input
          type="date"
          value={from}
          onChange={(e) => update({ from: e.target.value || undefined })}
          aria-label="Filter from date"
          max={to || undefined}
        />
      </Field>

      <Field label="To">
        <Input
          type="date"
          value={to}
          onChange={(e) => update({ to: e.target.value || undefined })}
          aria-label="Filter to date"
          min={from || undefined}
        />
      </Field>

      <div className="ml-auto self-end">
        <Button
          variant="ghost"
          type="button"
          disabled={pending}
          onClick={() => {
            setQ("");
            startTransition(() => router.replace(`/transactions`));
          }}
        >
          <X className="h-3.5 w-3.5" /> Reset
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-[10.5px] font-medium uppercase tracking-wide text-[--color-muted]">
        {label}
      </span>
      {children}
    </label>
  );
}
