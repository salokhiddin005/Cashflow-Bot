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
} from "lucide-react";
import { Card } from "./ui";

export function Onboarding() {
  // Best-effort: pull a bot username from BotFather token format, but fall
  // back to a generic placeholder so this component renders without env vars.
  const botUsername =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_BOT_USERNAME
      ? process.env.NEXT_PUBLIC_BOT_USERNAME
      : "your_finance_bot";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-[--color-border] bg-gradient-to-br from-[--color-surface] via-[--color-surface] to-[--color-surface-2] px-6 py-10 lg:px-10 lg:py-12">
        {/* Subtle radial accent */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-60"
          style={{
            background:
              "radial-gradient(circle at center, rgba(79, 70, 229, 0.18), transparent 60%)",
          }}
        />
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[--color-border] bg-[--color-surface] px-2.5 py-1 text-[11px] font-medium text-[--color-muted]">
            <Sparkles className="h-3 w-3" /> Welcome to Cashflow Manager
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight lg:text-4xl">
            Your business finances, in one place.
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[--color-muted]">
            Built for SMBs in Uzbekistan. Talk to your bot in Uzbek, Russian, or English — by voice or
            text — and watch the numbers update here instantly. No spreadsheets, no app to learn.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="#quick-add-section"
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-[--color-brand] px-4 text-[13px] font-medium text-[--color-brand-foreground] shadow-sm hover:opacity-90"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Log my first transaction
            </Link>
            <a
              href={`https://t.me/${botUsername.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[--color-border] bg-[--color-surface] px-4 text-[13px] font-medium hover:bg-[--color-surface-2]"
            >
              <Send className="h-3.5 w-3.5" />
              Open the Telegram bot
            </a>
          </div>
        </div>
      </div>

      {/* Three explainer cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Step
          icon={Mic}
          title="Speak naturally"
          body={'Send a voice note like "1 200 000 sotuvdan, bugun". The bot transcribes it, picks the category, and confirms before saving.'}
        />
        <Step
          icon={MessageSquare}
          title="Or type a one-liner"
          body={'"Spent 350k on logistics yesterday" works too. The bot asks a follow-up if anything is ambiguous — never silently guesses.'}
        />
        <Step
          icon={ListTree}
          title="See it here in real time"
          body="Every entry the bot saves lands in this dashboard within seconds. You can edit or delete from either side."
        />
      </div>

      {/* Get-started checklist */}
      <Card className="px-6 py-5">
        <div className="mb-3 text-[12px] font-medium uppercase tracking-wide text-[--color-muted]">
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
      </Card>
    </div>
  );
}

function Step({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Mic;
  title: string;
  body: string;
}) {
  return (
    <Card className="px-5 py-4">
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-[--color-surface-2] text-[--color-foreground]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-[14px] font-semibold">{title}</div>
      <div className="mt-1 text-[13px] text-[--color-muted]">{body}</div>
    </Card>
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
    <li className="rounded-xl border border-[--color-border] p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[--color-surface-2] text-[12px] font-semibold text-[--color-foreground]">
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
