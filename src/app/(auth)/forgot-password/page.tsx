import Link from "next/link";
import { ForgotForm } from "./form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-2xl border border-[--color-border] bg-[--color-surface] p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1 text-[13.5px] text-[--color-muted]">
        Choose how you'd like to receive the reset link.
      </p>
      <div className="mt-6">
        <ForgotForm />
      </div>
      <div className="mt-6 text-[13px] text-[--color-muted]">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-[--color-foreground] hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
