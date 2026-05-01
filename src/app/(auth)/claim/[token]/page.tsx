import Link from "next/link";
import { redirect } from "next/navigation";
import { ClaimSwitcher } from "./form";
import { getClaimToken } from "@/lib/db/auth-queries";
import { getCurrentUser } from "@/lib/auth/session";
import { isExpired } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ tg?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const claim = await getClaimToken(token);
  const invalid = !claim || claim.used_at || isExpired(claim.expires_at);

  // Already signed in? Just send them to their dashboard. (Edge case — the
  // claim flow is mostly for signed-out users coming from a Telegram link.)
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="rounded-2xl border border-[--color-border] bg-[--color-surface] p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome — your dashboard is ready</h1>

      {invalid ? (
        <>
          <p className="mt-2 text-[13.5px] text-red-600 dark:text-red-400">
            This claim link is invalid, used, or has expired.
          </p>
          <p className="mt-4 text-[13px] text-[--color-muted]">
            Go back to the Telegram bot and send <code className="rounded bg-[--color-surface-2] px-1.5 py-0.5">/dashboard</code> — it'll send you a fresh link.
          </p>
          <div className="mt-4 text-[13px]">
            <Link href="/login" className="font-medium hover:underline">
              Or sign in to an existing account
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-[13.5px] text-[--color-muted]">
            Create an account to access your dashboard from the web. Everything you've already
            logged via the bot will be there.
          </p>
          <div className="mt-6">
            <ClaimSwitcher token={token} prefilledTgUsername={sp.tg ?? null} />
          </div>
        </>
      )}
    </div>
  );
}
