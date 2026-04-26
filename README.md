# Sahifa — Business Finance Manager

A Telegram bot + web dashboard that lets a small or medium business in Uzbekistan log income and expenses **by talking to a bot** in Uzbek, Russian, or English (voice or text), and see everything in one place. Built for the Task 01 brief.

- **Live demo:** https://cashflow-bot-bice.vercel.app
- **Telegram bot:** [@business_ledger_bot](https://t.me/business_ledger_bot)

## Highlights

- **Telegram bot** — voice or text in uz/ru/en. A single Gemini 2.5 Flash call transcribes voice and classifies the intent; the bot confirms naturally, asks a follow-up only when truly ambiguous, and never silently saves wrong data.
- **Multi-page dashboard** — Overview (sparkline KPIs, period comparison, daily activity heatmap, recurring patterns, quick-add), Transactions (filters with live search, inline edit/delete, anomaly flags), Analytics (trend, donut breakdowns, balance-over-time, **30-day cash-flow forecast**), Categories (full CRUD with localized labels).
- **Real-time sync** — when the bot saves a transaction, every open dashboard tab refreshes within seconds via Server-Sent Events. A toast notification confirms it came from the bot.
- **Cash-flow runway + anomaly detection** (the unprompted features) — Overview shows current cash position and months-of-runway at the trailing 30-day burn rate. The Transactions list flags any expense ≥ 3× the 90-day median for that category as **Unusual**. Recurring transactions (rent, payroll, subscriptions) are auto-detected with cadence and next-due date.
- **Tap-only UX in the bot** — persistent main menu (`➕ Add / 📊 Report / 📋 Recent / 📂 Categories / ℹ️ Help`), a step-by-step wizard for adding transactions, inline confirmation buttons before destructive deletes. The free-form natural-language path still works for power users.

## Product brief

**Who it's for:** owners and finance staff at small-to-medium businesses in Uzbekistan who today track cash via WhatsApp voice notes, paper notebooks, and ad-hoc Excel sheets.

**Problem:** there's no single place that shows what's coming in, what's going out, and where the money is actually going — and the people closest to the money (drivers, sales, owner) are not the people sitting at a laptop.

**Solution:** a Telegram bot anyone in the team can speak to in their own language, backed by a clean dashboard the owner uses to monitor and decide. Voice → bot → dashboard in seconds. No data entry training required.

**v2 would add:** receipts (photo + OCR), per-user permissions and roles, multi-currency with live FX, exportable monthly P&L, and Telegram-side approval flow for expenses above a threshold.

## Quick start (local development)

```bash
git clone <this-repo>
cd finance-manager
cp .env.example .env.local       # fill in the keys (see below)
npm install
npm run dev                      # dashboard on http://localhost:3000
```

In a second terminal:

```bash
npm run bot:dev                  # long-polls Telegram (no public URL needed in dev)
```

### Required environment variables

| Variable                   | Why                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`             | Postgres connection string. Get a free DB at [neon.tech](https://neon.tech) (no card, scales to zero).               |
| `TELEGRAM_BOT_TOKEN`       | From [@BotFather](https://t.me/BotFather), `/newbot`                                                                 |
| `NEXT_PUBLIC_BOT_USERNAME` | Public bot handle (no `@`). Surfaced in the dashboard for the QR / deep-link.                                        |
| `GEMINI_API_KEY`           | Free key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — handles voice + intent in one call. |
| `TELEGRAM_WEBHOOK_SECRET`  | Optional, random string. Verified on every webhook delivery in production.                                           |
| `APP_BASE_URL`             | Public HTTPS URL of the deployed dashboard, used by `bot:set-webhook`.                                               |

The DB schema migrates automatically on first query (idempotent — uses `IF NOT EXISTS`). Default categories seed on first boot.

### Optional: seed sample data

```bash
npx tsx scripts/seed-sample-data.ts
```

Drops ~22 realistic transactions over the last 30 days so the dashboard isn't empty for first-time reviewers.

## Deployment (Vercel + Neon)

1. **Provision Postgres**: create a project at https://neon.tech, copy the connection string.
2. **Push to GitHub**: standard `git push` workflow.
3. **Import the repo on Vercel**: https://vercel.com → New Project → select the repo. Vercel auto-detects Next.js.
4. **Add environment variables** on Vercel (Settings → Environment Variables): paste each of the variables from the table above.
5. **Deploy**: Vercel builds and assigns a `https://<project>.vercel.app` URL.
6. **Register the Telegram webhook** against the live URL:

```bash
APP_BASE_URL=https://<project>.vercel.app npm run bot:set-webhook
```

After this, the bot stops needing `bot:dev` (long-polling) — Telegram POSTs every update straight to `/api/telegram/webhook` on Vercel.

## How it's wired

```
┌──────────────┐     POST /api/telegram/webhook
│  Telegram    │ ──────────────────────────────┐
│  user        │ ◀─── reply (text) ────────────│
└──────────────┘                                ▼
                          ┌──────────────────────────────┐
                          │  Next.js 16 on Vercel        │
                          │                              │
                          │  /api/telegram/webhook  ─────┼─→ Gemini 2.5 Flash
                          │  /api/events  (SSE)          │    (audio + intent JSON
                          │  /api/summary                │     in one call)
                          │  / + /transactions etc.      │
                          │       │  ▲                   │
                          │       ▼  │                   │
                          │   pg pool over WebSocket     │
                          └────────────┬─────────────────┘
                                       ▼
                          ┌──────────────────────────────┐
                          │   Neon Postgres              │
                          │   (serverless, scale-to-zero)│
                          └──────────────────────────────┘
                                       │
                                       │ realtime fanout (SSE)
                                       ▼
                          ┌──────────────────────────────┐
                          │  Dashboard tabs              │
                          │  (live updates, no refresh)  │
                          └──────────────────────────────┘
```

A single Vercel project hosts the dashboard, the bot webhook, the SSE stream, and a small JSON API. The bot and the dashboard both publish events to an in-process bus; the SSE route fans out to subscribed browser tabs, so a transaction logged via voice on Telegram appears in the dashboard within seconds without a refresh.

### Conventions worth knowing

- All money is stored as integer UZS (no subunit). The schema supports an `original_currency` + `original_amount` + `fx_rate` triple if you log in USD, but the app currently nudges UZS only.
- Categories store stable English keys (`sales`, `logistics`, …) and per-language labels. The bot prompts the LLM with the keys; the dashboard displays the localized label.
- The bot writes to `bot_chat_state` per chat so "delete that" / "fix that" / multi-turn wizard flows can find the right context.
- Voice format from Telegram is Opus inside an `.oga` container — Gemini accepts it natively as `audio/ogg`, no ffmpeg required.

## Trade-offs taken

- **Single provider for AI** (Gemini, not Whisper + Claude). Voice and intent parsing happen in one API call — fewer keys, fewer failure modes, lower latency, and Gemini's free tier covers any expected demo use without a credit card.
- **Postgres on Neon** rather than self-hosted or Railway. Native serverless driver matches Vercel's execution model; scale-to-zero keeps the free tier truly free.
- **Server Actions over a REST API** for dashboard mutations — fewer moving parts, automatic revalidation, smaller diff. There's still a JSON [`/api/summary`](src/app/api/summary/route.ts) endpoint for external consumers.
- **No auth.** The brief calls this a "team can speak to" tool — modeled as one workspace per deployment. Multi-tenant + role-based auth is in v2.
- **Dashboard UI in English; categories localized.** The owner-facing UI rarely changes language; the categories the bot sees and the bot's spoken responses do.

## What I'd add next if I had three more days

I'd ship **photo receipts** (Telegram photo → Gemini vision extracts merchant + line items + total → pre-filled transaction with the photo attached and viewable in the dashboard). Then **a "month close" review screen** that walks the owner through every flagged anomaly, every uncategorized entry, and a one-click "looks right" button — turning the dashboard from a passive ledger into a 5-minute monthly ritual. After that, **Telegram-side spending approvals** ("Karim wants to spend 4M on inventory — approve / decline?") so the owner stops being a bottleneck without losing oversight.
