"use client";

import { useActionState, useState } from "react";
import { forgotPasswordAction, type ForgotResult } from "../actions";

export function ForgotForm() {
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [state, formAction, pending] = useActionState<ForgotResult | null, FormData>(
    forgotPasswordAction,
    null,
  );
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="channel" value={channel} />
      <div className="flex gap-2 rounded-md border border-[--color-border] bg-[--color-surface-2] p-1 text-[12.5px]">
        <ChannelButton active={channel === "email"} onClick={() => setChannel("email")}>
          📧 Email
        </ChannelButton>
        <ChannelButton active={channel === "phone"} onClick={() => setChannel("phone")}>
          📱 Phone
        </ChannelButton>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-[--color-muted]">
          {channel === "email" ? "Email address" : "Phone number"}
        </span>
        <input
          name="identifier"
          type={channel === "email" ? "email" : "tel"}
          required
          autoComplete={channel === "email" ? "email" : "tel"}
          className="h-10 rounded-md border border-[--color-border] bg-[--color-surface] px-3 text-[14px] outline-none focus:border-[--color-brand]"
        />
      </label>

      {state && state.ok ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12.5px] text-emerald-700 dark:text-emerald-400">
          {state.message}
          {state.devLink ? (
            <div className="mt-2 break-all">
              Dev mode link:{" "}
              <a className="font-medium underline" href={state.devLink}>
                {state.devLink}
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
      {state && !state.ok ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-700 dark:text-red-400">
          {state.error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-md bg-[--color-brand] text-[13.5px] font-medium text-[--color-brand-foreground] hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>

      <p className="text-[11.5px] leading-relaxed text-[--color-muted]">
        SMS-based reset is coming soon. If you only have a Telegram username, send /reset to the bot
        and it will DM you a fresh reset link.
      </p>
    </form>
  );
}

function ChannelButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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
