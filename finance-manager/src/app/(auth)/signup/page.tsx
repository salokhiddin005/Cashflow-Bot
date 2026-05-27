import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "./form";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ claim?: string; tg?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const sp = await searchParams;
  return (
    <div className="rounded-2xl border border-[--color-border] bg-[--color-surface] p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-[13.5px] text-[--color-muted]">
        Sign up with any combination of email, phone, or Telegram username — pick whatever you'll
        remember to log in with later.
      </p>
      <div className="mt-6">
        <SignupForm claimToken={sp.claim ?? null} prefilledTgUsername={sp.tg ?? null} />
      </div>
      <div className="mt-6 text-[13px] text-[--color-muted]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[--color-foreground] hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
