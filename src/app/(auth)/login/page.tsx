import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "./form";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="rounded-2xl border border-[--color-border] bg-[--color-surface] p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-[13.5px] text-[--color-muted]">
        Sign in with your email, phone, or Telegram username.
      </p>
      <div className="mt-6">
        <LoginForm />
      </div>
      <div className="mt-6 flex flex-col gap-2 text-[13px] text-[--color-muted]">
        <Link href="/forgot-password" className="hover:underline">Forgot password?</Link>
        <div>
          New here?{" "}
          <Link href="/signup" className="font-medium text-[--color-foreground] hover:underline">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
