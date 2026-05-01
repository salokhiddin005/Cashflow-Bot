import Link from "next/link";
import {
  Mic,
  MessageSquare,
  ListTree,
  Sparkles,
  Send,
  ArrowRight,
  Tags,
  PlayCircle,
  Wand2,
} from "lucide-react";

export function Onboarding() {
  // Best-effort: pull a bot username from env, but fall back to a generic
  // placeholder so this component renders without env vars set.
  const botUsername =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_BOT_USERNAME
      ? process.env.NEXT_PUBLIC_BOT_USERNAME
      : "your_finance_bot";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-hero relative overflow-hidden rounded-3xl border border-[--color-border] px-6 py-12 lg:px-12 lg:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle at center, rgba(251,146,60,0.65), transparent 60%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-20 h-80 w-80 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle at center, rgba(252,211,77,0.55), transparent 60%)" }}
        />
        <div className="animate-fade-in-up relative max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/40 px-2.5 py-1 text-[11px] font-medium text-[--color-foreground] backdrop-blur dark:border-white/10 dark:bg-white/5">
            <Sparkles className="h-3 w-3" />
            <span>Welcome — your dashboard is alive</span>
          </div>
          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight lg:text-5xl">
            Track money like you{" "}
            <span className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 bg-clip-text text-transparent">
              text a friend
            </span>
            .
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[--color-foreground]/80">
            Log a transaction in any language — voice or text. Watch the numbers update here in
            real time. No spreadsheets, no app to learn, no Monday-morning data entry.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {/* Primary CTA — warm gradient. Matches Button variant="primary"
                visually but uses an <a> for semantic correctness. */}
            <Link
              href="#quick-add-section"
              className="group inline-flex h-11 items-center gap-1.5 rounded-md bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 px-5 text-[13.5px] font-medium text-white shadow-[0_4px_14px_-4px_rgba(234,88,12,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:from-amber-400 hover:via-orange-400 hover:to-rose-400 hover:shadow-[0_8px_22px_-6px_rgba(234,88,12,0.6)] active:translate-y-0"
            >
              <PlayCircle className="h-4 w-4 transition-transform group-hover:scale-110" />
              Log my first transaction
            </Link>
            {/* Telegram brand-blue — instantly recognisable, semantic <a>. */}
            <a
              href={`https://t.me/${botUsername.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex h-11 items-center gap-1.5 rounded-md bg-gradient-to-br from-sky-500 to-blue-600 px-5 text-[13.5px] font-medium text-white shadow-[0_4px_14px_-4px_rgba(14,165,233,0.45)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:from-sky-400 hover:to-blue-500 hover:shadow-[0_8px_22px_-6px_rgba(14,165,233,0.55)] active:translate-y-0"
            >
              <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              Open the Telegram bot
            </a>
          </div>
        </div>
      </div>

      {/* Three explainer cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Step icon={Mic}             tone="emerald"
              title="Speak naturally"
              body={'Send a voice note like "1 200 000 sotuvdan, bugun". The bot transcribes it, picks the category, and confirms before saving.'} />
        <Step icon={MessageSquare}   tone="indigo"
              title="Or type a one-liner"
              body={'"Spent 350k on logistics yesterday" works too. The bot asks a follow-up if anything is ambiguous — never silently guesses.'} />
        <Step icon={ListTree}        tone="amber"
              title="See it here in real time"
              body="Every entry the bot saves lands in this dashboard within seconds. You can edit or delete from either side." />
      </div>

      {/* Get-started checklist */}
      <div className="rounded-2xl border border-[--color-border] bg-[--color-surface] px-6 py-5">
        <div className="mb-3 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wide text-[--color-muted]">
          <Wand2 className="h-3.5 w-3.5" />
          Get started in 3 steps
        </div>
        <ol className="grid gap-3 md:grid-cols-3">
          <ChecklistItem
            n={1}
            title="Open the bot"
            body="Search for the bot on Telegram and tap Start. Pick your language."
            href={`https://t.me/${botUsername.replace(/^@/, "")}`}
            cta="Open bot"
            external
          />
          <ChecklistItem
            n={2}
            title="Set your categories"
            body="The defaults cover most SMBs (Sales, Rent, Logistics, Payroll…). Add your own anytime."
            href="/categories"
            cta="Manage categories"
          />
          <ChecklistItem
            n={3}
            title="Log your first transaction"
            body="Send the bot a voice note or use the quick-add form here on the right."
            href="#quick-add-section"
            cta="Quick add"
          />
        </ol>
      </div>
    </div>
  );
}

function Step({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: typeof Mic;
  title: string;
  body: string;
  tone: "emerald" | "indigo" | "amber";
}) {
  const wash =
    tone === "emerald" ? "bg-wash-emerald" : tone === "indigo" ? "bg-wash-indigo" : "bg-wash-amber";
  const iconBg =
    tone === "emerald" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : tone === "indigo"  ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                         : "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return (
    <div className={`hover-lift rounded-xl border border-[--color-border] bg-[--color-surface] px-5 py-4 ${wash}`}>
      <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-[14px] font-semibold">{title}</div>
      <div className="mt-1 text-[13px] text-[--color-muted]">{body}</div>
    </div>
  );
}

function ChecklistItem({
  n,
  title,
  body,
  href,
  cta,
  external,
}: {
  n: number;
  title: string;
  body: string;
  href: string;
  cta: string;
  external?: boolean;
}) {
  const linkProps = external
    ? { href, target: "_blank", rel: "noopener noreferrer" as const }
    : { href };
  return (
    <li className="hover-lift rounded-xl border border-[--color-border] p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-rose-500 text-[12px] font-semibold text-white shadow-sm">
          {n}
        </div>
        <div className="text-[13.5px] font-semibold">{title}</div>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-[--color-muted]">{body}</p>
      <Link
        {...linkProps}
        className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-[--color-foreground] hover:underline"
      >
        {n === 2 ? <Tags className="h-3 w-3" /> : null}
        {cta}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </li>
  );
}
