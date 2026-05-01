"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { resetPasswordAction, type ResetResult } from "../../actions";

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ResetResult | null, FormData>(
    resetPasswordAction,
    null,
  );
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <Field name="password" type="password" label="New password" autoComplete="new-password" required />
      <Field name="confirm" type="password" label="Confirm password" autoComplete="new-password" required />
      {state && !state.ok ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-700 dark:text-red-400">
          {state.error}
        </div>
      ) : null}
      <Button type="submit" variant="success" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  autoComplete,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-[--color-muted]">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className="h-10 rounded-md border border-[--color-border] bg-[--color-surface] px-3 text-[14px] outline-none focus:border-[--color-brand]"
      />
    </label>
  );
}
