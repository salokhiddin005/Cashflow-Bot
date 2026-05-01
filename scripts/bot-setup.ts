// One-shot setup script: registers the bot's slash-command menu, public
// description, "About" text, and (optionally) a menu button that opens the
// dashboard. Run after creating the bot and any time you want to refresh
// the metadata. Reads TELEGRAM_BOT_TOKEN and APP_BASE_URL from .env.local.
//
//   npm run bot:setup
//
// Idempotent — safe to re-run.

import "./_env";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN missing");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;

type Cmd = { command: string; description: string };

const COMMANDS_EN: Cmd[] = [
  { command: "start",      description: "Welcome screen" },
  { command: "add",        description: "Add a new transaction (step-by-step)" },
  { command: "dashboard",  description: "Open your personal dashboard" },
  { command: "report",     description: "Quick summary of this month" },
  { command: "categories", description: "List your income / expense categories" },
  { command: "undo",       description: "Delete the last entry" },
  { command: "reset",      description: "Reset your dashboard password" },
  { command: "lang",       description: "Change language" },
  { command: "help",       description: "Show help and examples" },
];
const COMMANDS_UZ: Cmd[] = [
  { command: "start",      description: "Boshlash sahifasi" },
  { command: "add",        description: "Yangi tranzaksiya qo'shish (qadamma-qadam)" },
  { command: "dashboard",  description: "Shaxsiy boshqaruv panelini ochish" },
  { command: "report",     description: "Joriy oy hisoboti" },
  { command: "categories", description: "Kategoriyalar ro'yxati" },
  { command: "undo",       description: "Oxirgi yozuvni o'chirish" },
  { command: "reset",      description: "Parolni tiklash" },
  { command: "lang",       description: "Tilni o'zgartirish" },
  { command: "help",       description: "Yordam va misollar" },
];
const COMMANDS_RU: Cmd[] = [
  { command: "start",      description: "Приветствие" },
  { command: "add",        description: "Добавить транзакцию (пошагово)" },
  { command: "dashboard",  description: "Открыть личную панель" },
  { command: "report",     description: "Сводка по текущему месяцу" },
  { command: "categories", description: "Список категорий доходов и расходов" },
  { command: "undo",       description: "Удалить последнюю запись" },
  { command: "reset",      description: "Сбросить пароль" },
  { command: "lang",       description: "Сменить язык" },
  { command: "help",       description: "Помощь и примеры" },
];

const DESCRIPTION_EN =
  "Track your business cash flow by chatting in Uzbek, Russian, or English — by voice or text. " +
  "Logs income and expenses, gives reports, and syncs with a polished web dashboard.";
const DESCRIPTION_UZ =
  "Biznesingiz pul oqimini o'zbek, rus yoki ingliz tillarida ovoz yoki matn orqali yozib boring. " +
  "Kirim/chiqimni qayd qiladi, hisobotlar beradi va veb-panel bilan sinxron ishlaydi.";
const DESCRIPTION_RU =
  "Учёт денежного потока в бизнесе на узбекском, русском или английском — голосом или текстом. " +
  "Записывает приходы и расходы, даёт отчёты, синхронизирован с веб-панелью.";

const SHORT_EN = "Cashflow Manager — voice & text bookkeeping for SMBs";
const SHORT_UZ = "Cashflow Manager — kichik biznes uchun ovozli buxgalteriya";
const SHORT_RU = "Cashflow Manager — голосовая бухгалтерия для бизнеса";

async function call(method: string, body: unknown) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${method}: ${json.description}`);
  return json.result;
}

async function setCommands(commands: Cmd[], language_code?: string) {
  await call("setMyCommands", { commands, ...(language_code ? { language_code } : {}) });
  console.log(`✓ commands set (${language_code ?? "default"})`);
}

async function setDescription(description: string, language_code?: string) {
  await call("setMyDescription", { description, ...(language_code ? { language_code } : {}) });
  console.log(`✓ description set (${language_code ?? "default"})`);
}

async function setShortDescription(short_description: string, language_code?: string) {
  await call("setMyShortDescription", { short_description, ...(language_code ? { language_code } : {}) });
  console.log(`✓ short description set (${language_code ?? "default"})`);
}

async function setMenuButton(url?: string) {
  const menu_button =
    url && /^https:\/\//.test(url)
      ? { type: "web_app", text: "Dashboard", web_app: { url } }
      : { type: "default" };
  await call("setChatMenuButton", { menu_button });
  console.log(`✓ menu button: ${menu_button.type}${url ? ` → ${url}` : ""}`);
}

async function main() {
  // Default = English; per-language overrides via Telegram's i18n hooks.
  await setCommands(COMMANDS_EN);
  await setCommands(COMMANDS_UZ, "uz");
  await setCommands(COMMANDS_RU, "ru");

  await setDescription(DESCRIPTION_EN);
  await setDescription(DESCRIPTION_UZ, "uz");
  await setDescription(DESCRIPTION_RU, "ru");

  await setShortDescription(SHORT_EN);
  await setShortDescription(SHORT_UZ, "uz");
  await setShortDescription(SHORT_RU, "ru");

  // Each user has their own dashboard URL now (signed claim link or session-
  // gated /login). A static menu-button URL would point everyone at the same
  // place, so use the default commands-menu — users tap /dashboard to get
  // their personal link.
  await setMenuButton(undefined);

  console.log("\n✓ Bot profile updated.");
}

main().catch((e) => { console.error(e); process.exit(1); });
