import { refreshBotDescription } from "@/lib/bot/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel cron hits this on a schedule (configured in vercel.json) to push
// the current monthly-active-user count into the bot's Telegram description
// — that's the line some clients show under the bot name in the chat
// header (the "X monthly users" subtitle the user wanted).
//
// Gated by Vercel's CRON_SECRET so random callers can't trigger it.
export async function GET(req: Request) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("forbidden", { status: 403 });
    }
  }
  const result = await refreshBotDescription();
  if (!result.ok) {
    console.warn("[cron] update-bot-stats failed:", result.reason);
    return Response.json({ ok: false, reason: result.reason }, { status: 500 });
  }
  return Response.json({ ok: true, stats: result.stats });
}

// Manual trigger via POST — same handler. Useful for hitting it on demand
// from a curl while testing.
export const POST = GET;
