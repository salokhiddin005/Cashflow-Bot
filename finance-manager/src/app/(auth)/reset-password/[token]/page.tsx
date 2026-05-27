import Link from "next/link";
import { ResetForm } from "./form";
import { getPasswordResetToken } from "@/lib/db/auth-queries";
import { isExpired } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const row = await getPasswordResetToken(token);
  const invalid = !row || row.used_at || isExpired(row.expires_at);

  return (
    <div className="rounded-2xl border border-[--color-border] bg-[--color-surface] p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
      {invalid ? (
        <>
          <p className="mt-2 text-[13.5px] text-red-600 dark:text-red-400">
            This reset link is invalid or has expired.
          </p>
          <div className="mt-6 text-[13px]">
            <Link href="/forgot-password" className="font-medium hover:underline">
              Request a new one
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-[13.5px] text-[--color-muted]">
            Pick a new password — you'll be signed in automatically once it's saved.
          </p>
          <div className="mt-6">
            <ResetForm token={token} />
          </div>
        </>
      )}
    </div>
  );
}
