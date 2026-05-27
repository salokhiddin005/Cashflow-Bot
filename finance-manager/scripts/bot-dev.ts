// Long-polling bot runner for local development.
// Use `npm run bot:dev` so you can test the bot without a public HTTPS URL.

import "./_env";
import { getBot } from "../src/lib/bot/telegram";

async function main() {
  const bot = getBot();
  // Drop any pending webhook so polling can start cleanly.
  await bot.api.deleteWebhook({ drop_pending_updates: false }).catch(() => {});
  console.log("✓ Long-polling started. Press Ctrl+C to stop.");
  await bot.start({
    onStart: (info) => console.log(`✓ @${info.username} listening for updates`),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
