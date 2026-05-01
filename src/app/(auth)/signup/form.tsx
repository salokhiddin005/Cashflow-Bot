"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { signupAction, type SignupResult } from "../actions";

export function SignupForm({
  claimToken,
  prefilledTgUsername,
}: {
  claimToken: string | null;
  prefilledTgUsername: string | null;
}) {
  const [state, formAction, pending] = useActionState<SignupResult | null, FormData>(signupAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {claimToken ? <input type="hidden" name="claim_token" value={claimToken} /> : null}

      <p className="text-[12px] text-[--color-muted]">
        Fill in at least one identifier — you'll be able to sign in with whichever you provide.
      </p>

      <Field name="email" type="email" label="Email" autoComplete="email" />
      <Field name="phone" type="tel" label="Phone (optional)" autoComplete="tel" />
      <Field
        name="tg_username"
        label="Telegram username (optional)"
        autoComplete="username"
        placeholder="@yourname"
        defaultValue={prefilledTgUsername ?? ""}
      />

      <div className="my-1 border-t border-[--color-border]" />

      <Field name="password" type="password" label="Password" autoComplete="new-password" required />
      <Field name="confirm" type="password" label="Confirm password" autoComplete="new-password" required />

      {state && !state.ok ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-700 dark:text-red-400">
          {state.error}
        </div>
      ) : null}

      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
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
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-[--color-muted]">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="h-10 rounded-md border border-[--color-border] bg-[--color-surface] px-3 text-[14px] outline-none focus:border-[--color-brand]"
      />
    </label>
  );
}
