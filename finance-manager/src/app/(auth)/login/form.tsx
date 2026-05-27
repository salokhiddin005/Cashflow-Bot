"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { loginAction, type LoginResult } from "../actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginResult | null, FormData>(loginAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        name="identifier"
        label="Email, phone, or @username"
        autoComplete="username"
        required
      />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
      />
      {state && !state.ok ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-700 dark:text-red-400">
          {state.error}
        </div>
      ) : null}
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
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
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
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
        defaultValue={defaultValue}
        className="h-10 rounded-md border border-[--color-border] bg-[--color-surface] px-3 text-[14px] outline-none focus:border-[--color-brand]"
      />
    </label>
  );
}
