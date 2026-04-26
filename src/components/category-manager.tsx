"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Save, X, Archive, ArchiveRestore, Plus, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import type { Category } from "@/lib/db/types";
import {
  addCategoryAction,
  archiveCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/app/actions";
import { Button, Card, CardBody, CardHeader, Input } from "./ui";
import { useConfirm } from "./confirm-dialog";

const COLORS = [
  "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e", "#ef4444", "#f59e0b",
  "#84cc16", "#22d3ee", "#64748b",
];

export function CategoryManager({ categories }: { categories: Category[] }) {
  const income  = categories.filter((c) => c.kind === "income");
  const expense = categories.filter((c) => c.kind === "expense");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CategorySection title="Income" categories={income} kind="income" />
      <CategorySection title="Expense" categories={expense} kind="expense" />
    </div>
  );
}

function CategorySection({
  title,
  categories,
  kind,
}: {
  title: string;
  categories: Category[];
  kind: "income" | "expense";
}) {
  const [adding, setAdding] = useState(false);
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-[12px] text-[--color-muted]">{categories.length} categor{categories.length === 1 ? "y" : "ies"}</div>
        </div>
        <Button variant="secondary" onClick={() => setAdding((v) => !v)}>
          {adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {adding ? "Cancel" : "Add"}
        </Button>
      </CardHeader>

      {adding ? (
        <div className="border-b border-[--color-border] bg-[--color-surface-2]/40 px-5 py-4">
          <NewCategoryForm kind={kind} onDone={() => setAdding(false)} />
        </div>
      ) : null}

      <CardBody className="px-0 py-0">
        <ul className="divide-y divide-[--color-border]">
          {categories.map((c) => (
            <CategoryRow key={c.id} category={c} />
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  if (editing) {
    return (
      <li className="px-5 py-3">
        <form
          action={(fd) => {
            fd.set("id", String(category.id));
            startTransition(async () => {
              await updateCategoryAction(fd);
              setEditing(false);
            });
          }}
          className="space-y-2"
        >
          <div className="grid gap-2 sm:grid-cols-3">
            <Input name="label_en" defaultValue={category.label_en} placeholder="English" required />
            <Input name="label_ru" defaultValue={category.label_ru} placeholder="Русский" required />
            <Input name="label_uz" defaultValue={category.label_uz} placeholder="O'zbekcha" required />
          </div>
          <ColorPicker name="color" defaultValue={category.color} />
          <input type="hidden" name="icon" value={category.icon} />
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-[--color-border] bg-[--color-surface] px-2.5 text-[12.5px] hover:bg-[--color-surface-2]"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center gap-1 rounded-md bg-[--color-brand] px-2.5 text-[12.5px] font-medium text-[--color-brand-foreground] hover:opacity-90 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={clsx("group flex items-center gap-3 px-5 py-2.5", category.is_archived && "opacity-50")}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: category.color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-medium">{category.label_en}</span>
          {category.is_system ? <span className="rounded-full bg-[--color-surface-2] px-1.5 py-0.5 text-[10px] font-medium text-[--color-muted]">default</span> : null}
          {category.is_archived ? <span className="rounded-full bg-[--color-surface-2] px-1.5 py-0.5 text-[10px] font-medium text-[--color-muted]">archived</span> : null}
        </div>
        <div className="text-[11.5px] text-[--color-muted]">
          {category.label_ru} · {category.label_uz} · <span className="font-mono text-[10.5px]">{category.key}</span>
        </div>
      </div>
      <div className="inline-flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          onClick={() => setEditing(true)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[--color-muted] hover:bg-[--color-surface-2] hover:text-[--color-foreground]"
          aria-label="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <form
          action={(fd) => {
            fd.set("id", String(category.id));
            fd.set("archived", category.is_archived ? "0" : "1");
            startTransition(async () => { await archiveCategoryAction(fd); });
          }}
        >
          <button
            type="submit"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[--color-muted] hover:bg-[--color-surface-2] hover:text-[--color-foreground]"
            aria-label={category.is_archived ? "Restore" : "Archive"}
          >
            {category.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          </button>
        </form>
        {!category.is_system ? (
          <form
            action={async (fd) => {
              fd.set("id", String(category.id));
              const ok = await confirm({
                title: `Delete "${category.label_en}"?`,
                description: "Transactions using this category will keep their reference. This can't be undone.",
                confirmText: "Yes, delete",
                variant: "danger",
              });
              if (!ok) return;
              startTransition(async () => { await deleteCategoryAction(fd); });
            }}
          >
            <button
              type="submit"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[--color-muted] hover:bg-red-500/10 hover:text-red-600"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : null}
      </div>
    </li>
  );
}

function NewCategoryForm({ kind, onDone }: { kind: "income" | "expense"; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      action={(fd) => {
        setError(null);
        fd.set("kind", kind);
        startTransition(async () => {
          try {
            await addCategoryAction(fd);
            onDone();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save");
          }
        });
      }}
      className="space-y-2"
    >
      <Input name="key" placeholder="key (e.g. coffee_supplies)" required pattern="[a-z][a-z0-9_]*" />
      <div className="grid gap-2 sm:grid-cols-3">
        <Input name="label_en" placeholder="English label"  required />
        <Input name="label_ru" placeholder="Русский ярлык"  required />
        <Input name="label_uz" placeholder="O'zbekcha nom"  required />
      </div>
      <ColorPicker name="color" defaultValue="#64748b" />
      <input type="hidden" name="icon" value="circle" />
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create
      </Button>
    </form>
  );
}

function ColorPicker({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [color, setColor] = useState(defaultValue);
  return (
    <div>
      <input type="hidden" name={name} value={color} />
      <div className="flex flex-wrap gap-1">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={clsx(
              "h-6 w-6 rounded-full border",
              color === c ? "ring-2 ring-offset-2 ring-[--color-accent] ring-offset-[--color-surface] border-transparent" : "border-[--color-border]",
            )}
            style={{ background: c }}
            aria-label={`Pick color ${c}`}
          />
        ))}
      </div>
    </div>
  );
}
