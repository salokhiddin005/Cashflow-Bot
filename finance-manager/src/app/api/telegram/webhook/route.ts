import { webhookCallback } from "grammy";
import { getBot } from "@/lib/bot/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Voice messages need time to: download from Telegram, send to Gemini for
// transcription + intent parsing, and write to Postgres. Vercel's default
// 10s timeout on Hobby plan kills this mid-call. Bump to the Hobby max.
export const maxDuration = 60;

let _handler: ((req: Request) => Promise<Response>) | null = null;
function handler() {
  if (!_handler) _handler = webhookCallback(getBot(), "std/http");
  return _handler;
}

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== secret) {
      return new Response("forbidden", { status: 403 });
    }
  }
  try {
    return await handler()(req);
  } catch (e) {
    console.error("webhook handler crashed", e);
    // Always 200 — Telegram retries 5xx and we don't want a crash storm.
    return new Response("ok", { status: 200 });
  }
}

export async function GET() {
  return Response.json({ ok: true, hint: "POST Telegram updates here" });
}
