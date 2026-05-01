import { getBot } from "./telegram";

// Send a private message to a Telegram user from a server action / API route.
// Uses the bot's outbound API — does not require the webhook handler to be
// active. Returns true on success, false on any failure (caller can decide
// whether to surface that to the user).
export async function dmTelegramUser(telegramChatId: number, text: string): Promise<boolean> {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn("[bot-dm] TELEGRAM_BOT_TOKEN missing — would have sent:", { telegramChatId, text });
    return false;
  }
  try {
    await getBot().api.sendMessage(telegramChatId, text, { parse_mode: "Markdown" });
    return true;
  } catch (e) {
    console.error("[bot-dm] failed", e);
    return false;
  }
}

// Format a 6-digit OTP for the bot DM. Three languages so it matches the
// user's language preference set in the bot.
export function formatOtpMessage(code: string, lang: "uz" | "ru" | "en"): string {
  if (lang === "uz") {
    return `🔐 *Parolni tiklash kodi*\n\n\`${code}\`\n\nKod 10 daqiqa amal qiladi. Agar bu sizning so'rovingiz bo'lmasa, e'tiborsiz qoldiring.`;
  }
  if (lang === "ru") {
    return `🔐 *Код сброса пароля*\n\n\`${code}\`\n\nКод действителен 10 минут. Если вы не запрашивали сброс — игнорируйте это сообщение.`;
  }
  return `🔐 *Password reset code*\n\n\`${code}\`\n\nExpires in 10 minutes. Ignore this message if you didn't request a reset.`;
}
