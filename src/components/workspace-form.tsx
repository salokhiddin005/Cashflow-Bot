"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import type { Workspace } from "@/lib/db/types";
import { updateWorkspaceAction } from "@/app/actions";
import { Button, Input } from "./ui";

export function WorkspaceForm({ workspace }: { workspace: Workspace }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <form
      action={(fd) => {
        setSaved(false);
        startTransition(async () => {
          await updateWorkspaceAction(fd);
          setSaved(true);
        });
      }}
      className="grid gap-3 sm:grid-cols-3"
    >
      <div className="sm:col-span-3">
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[--color-muted]">Workspace name</label>
        <Input name="name" defaultValue={workspace.name} required />
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[--color-muted]">Starting balance (UZS)</label>
        <Input name="starting_balance" type="number" min={0} defaultValue={workspace.starting_balance} className="tabular-nums" />
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[--color-muted]">As of date</label>
        <Input name="starting_balance_at" type="date" defaultValue={workspace.starting_balance_at} />
      </div>
      <div className="flex items-end gap-2 sm:col-span-1">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
        {saved ? <span className="text-[12px] text-emerald-600">Saved</span> : null}
      </div>
    </form>
  );
}
