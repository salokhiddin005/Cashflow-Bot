"use client";

import { Mail, Phone } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import {
  forgotPasswordEmailAction,
  forgotPasswordPhoneRequestAction,
  forgotPasswordPhoneVerifyAction,
  type ForgotResult,
  type PhoneOtpRequestResult,
  type PhoneOtpVerifyResult,
} from "../actions";

type Channel = "email" | "phone";

export function ForgotForm() {
  const [channel, setChannel] = useState<Channel>("email");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 rounded-md border border-[--color-border] bg-[--color-surface-2] p-1 text-[12.5px]">
        <ChannelButton tone="email" active={channel === "email"} onClick={() => setChannel("email")}>
          <Mail className="h-3.5 w-3.5" /> Email
        </ChannelButton>
        <ChannelButton tone="phone" active={channel === "phone"} onClick={() => setChannel("phone")}>
          <Phone className="h-3.5 w-3.5" /> Phone
        </ChannelButton>
      </div>
      {channel === "email" ? <EmailForm /> : <PhoneFlow />}
      <p className="text-[11.5px] leading-relaxed text-[--color-muted]">
        Phone reset sends a 6-digit code to your Telegram chat with the bot. If you only have a
        Telegram username, send /reset to the bot and it will DM you a fresh reset link.
      </p>
    </div>
  );
}

function EmailForm() {
  const [state, formAction, pending] = useActionState<ForgotResult | null, FormData>(
    forgotPasswordEmailAction,
    null,
  );
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-[--color-muted]">Email address</span>
        <input
          name="identifier"
          type="email"
          required
          autoComplete="email"
          className="h-10 rounded-md border border-[--color-border] bg-[--color-surface] px-3 text-[14px] outline-none focus:border-[--color-brand]"
        />
      </label>
      {state && state.ok ? (
        <SuccessBox>
          {state.message}
          {state.devLink ? (
            <div className="mt-2 break-all">
              Dev mode link:{" "}
              <a className="font-medium underline" href={state.devLink}>
                {state.devLink}
              </a>
            </div>
          ) : null}
        </SuccessBox>
      ) : null}
      {state && !state.ok ? <ErrorBox>{state.error}</ErrorBox> : null}
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

// Phone flow is two-phase: enter phone → enter OTP. Phase is just local
// state — no URL routing needed since the OTP record id is opaque.
function PhoneFlow() {
  const [otpId, setOtpId] = useState<number | null>(null);
  const [requestMessage, setRequestMessage] = useState<string>("");

  if (otpId === null) {
    return (
      <PhoneRequestForm
        onSent={(id, message) => {
          setOtpId(id);
          setRequestMessage(message);
        }}
      />
    );
  }
  return (
    <PhoneVerifyForm
      otpId={otpId}
      message={requestMessage}
      onResend={() => {
        setOtpId(null);
        setRequestMessage("");
      }}
    />
  );
}

function PhoneRequestForm({ onSent }: { onSent: (id: number, message: string) => void }) {
  const [state, formAction, pending] = useActionState<PhoneOtpRequestResult | null, FormData>(
    async (prev, formData) => {
      const result = await forgotPasswordPhoneRequestAction(prev, formData);
      // useActionState replays the result back to render — but we also want
      // to advance the parent flow when sending succeeds, hence this hop.
      if (result.ok) onSent(result.otp_id, result.message);
      return result;
    },
    null,
  );
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-[--color-muted]">Phone number</span>
        <input
          name="identifier"
          type="tel"
          required
          autoComplete="tel"
          placeholder="+998 90 123 45 67"
          className="h-10 rounded-md border border-[--color-border] bg-[--color-surface] px-3 text-[14px] outline-none focus:border-[--color-brand]"
        />
      </label>
      {state && !state.ok ? <ErrorBox>{state.error}</ErrorBox> : null}
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Send code via Telegram"}
      </Button>
    </form>
  );
}

function PhoneVerifyForm({
  otpId,
  message,
  onResend,
}: {
  otpId: number;
  message: string;
  onResend: () => void;
}) {
  const [state, formAction, pending] = useActionState<PhoneOtpVerifyResult | null, FormData>(
    forgotPasswordPhoneVerifyAction,
    null,
  );
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="otp_id" value={otpId} />
      <SuccessBox>{message}</SuccessBox>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-[--color-muted]">6-digit code</span>
        <input
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="\d{6}"
          required
          className="h-12 rounded-md border border-[--color-border] bg-[--color-surface] px-3 text-center text-[20px] font-semibold tracking-[0.5em] tabular-nums outline-none focus:border-[--color-brand]"
          placeholder="••••••"
        />
      </label>
      {state && !state.ok ? <ErrorBox>{state.error}</ErrorBox> : null}
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Verifying…" : "Verify code & continue"}
      </Button>
      <button
        type="button"
        onClick={onResend}
        className="text-[12px] text-[--color-muted] underline-offset-2 hover:text-[--color-foreground] hover:underline"
      >
        Use a different number / resend code
      </button>
    </form>
  );
}

// ── Tiny presentational helpers ──────────────────────────────────────────

function SuccessBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12.5px] text-emerald-700 dark:text-emerald-400">
      {children}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-700 dark:text-red-400">
      {children}
    </div>
  );
}

// ── Channel toggle (warm-coloured per option) ────────────────────────────

function ChannelButton({
  tone,
  active,
  onClick,
  children,
}: {
  tone: "email" | "phone";
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const palette =
    tone === "email"
      ? {
          activeBg: "bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600",
          activeShadow: "shadow-[0_4px_14px_-4px_rgba(234,88,12,0.55)]",
          idleText: "text-amber-700/80 dark:text-amber-300/80",
          idleHover: "hover:bg-amber-500/15 hover:text-amber-700 dark:hover:text-amber-300",
        }
      : {
          activeBg: "bg-gradient-to-br from-rose-500 via-pink-500 to-rose-600",
          activeShadow: "shadow-[0_4px_14px_-4px_rgba(244,63,94,0.55)]",
          idleText: "text-rose-700/80 dark:text-rose-300/80",
          idleHover: "hover:bg-rose-500/15 hover:text-rose-700 dark:hover:text-rose-300",
        };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-sm px-3 py-2 font-medium transition-all duration-200 ${
        active
          ? `${palette.activeBg} ${palette.activeShadow} text-white`
          : `${palette.idleText} ${palette.idleHover}`
      }`}
    >
      {children}
    </button>
  );
}
