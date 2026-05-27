// Registers the public Telegram webhook against the deployed dashboard.
//   APP_BASE_URL=https://my-app.example npm run bot:set-webhook
// Reads TELEGRAM_BOT_TOKEN, APP_BASE_URL, and (optional) TELEGRAM_WEBHOOK_SECRET.

import "./_env";

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const base  = process.env.APP_BASE_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");
  if (!base)  throw new Error("APP_BASE_URL missing (e.g. https://yourapp.vercel.app)");

  const url = `${base.replace(/\/$/, "")}/api/telegram/webhook`;
  const params = new URLSearchParams({ url });
  if (secret) params.set("secret_token", secret);

  const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook?${params}`);
  const body = await r.json();
  console.log(JSON.stringify(body, null, 2));
  if (!body.ok) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
