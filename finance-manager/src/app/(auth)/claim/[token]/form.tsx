"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import {
  claimAndLoginAction,
  signupAction,
  type ClaimResult,
  type SignupResult,
} from "../../actions";

export function ClaimSwitcher({
  token,
  prefilledTgUsername,
}: {
  token: string;
  prefilledTgUsername: string | null;
}) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  return (
    <div className="space-y-5">
      <div className="flex gap-2 rounded-md border border-[--color-border] bg-[--color-surface-2] p-1 text-[12.5px]">
        <Tab active={mode === "signup"} onClick={() => setMode("signup")}>
          Create new account
        </Tab>
        <Tab active={mode === "signin"} onClick={() => setMode("signin")}>
          I already have one
        </Tab>
      </div>
      {mode === "signup" ? (
        <ClaimSignupForm token={token} prefilledTgUsername={prefilledTgUsername} />
      ) : (
        <ClaimSigninForm token={token} />
      )}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-sm px-3 py-1.5 ${
        active
          ? "bg-[--color-surface] text-[--color-foreground] shadow-sm"
          : "text-[--color-muted] hover:text-[--color-foreground]"
      }`}
    >
      {children}
    </button>
  );
}

function ClaimSignupForm({ token, prefilledTgUsername }: { token: string; prefilledTgUsername: string | null }) {
  const [state, formAction, pending] = useActionState<SignupResult | null, FormData>(signupAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="claim_token" value={token} />
      <p className="text-[12px] text-[--color-muted]">
        Provide at least one identifier — email, phone, or Telegram username.
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

      {state && !state.ok ? <ErrorBox>{state.error}</ErrorBox> : null}

      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Creating account…" : "Create account & open dashboard"}
      </Button>
    </form>
  );
}

function ClaimSigninForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ClaimResult | null, FormData>(claimAndLoginAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <Field name="identifier" label="Email, phone, or @username" autoComplete="username" required />
      <Field name="password" type="password" label="Password" autoComplete="current-password" required />
      {state && !state.ok ? <ErrorBox>{state.error}</ErrorBox> : null}
      <Button type="submit" variant="telegram" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in & connect bot"}
      </Button>
    </form>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-700 dark:text-red-400">
      {children}
    </div>
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
