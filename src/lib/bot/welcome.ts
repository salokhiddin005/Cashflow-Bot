import type { Lang } from "../db/types";

export type Strings = {
  welcome: string;
  help: string;
  noLast: string;
  cantUnderstand: string;
  edited: (when: string) => string;
  deleted: (cat: string, amount: string) => string;
  saved: string;
  whatNext: {
    edit: string;
    delete: string;
    dashboard: string;
  };
  cantParse: string;
  reportEmpty: string;
  langChanged: string;
};

const dashboardUrl = process.env.APP_BASE_URL?.trim() || "http://localhost:3000";

// ────────────────────────────────────────────────────────────────────
// Language picker — shown on /start and /lang
// ────────────────────────────────────────────────────────────────────

export const LANGUAGE_PICKER_TEXT =
  "🌐 *Choose your language*\n" +
  "🌐 *Tilni tanlang*\n" +
  "🌐 *Выберите язык*";

export const LANGUAGE_PICKER_BUTTONS: { text: string; callbackData: string }[] = [
  { text: "🇺🇿 O'zbekcha", callbackData: "lang:uz" },
  { text: "🇷🇺 Русский",   callbackData: "lang:ru" },
  { text: "🇬🇧 English",   callbackData: "lang:en" },
];

// ────────────────────────────────────────────────────────────────────
// Welcome message (after language is selected)
// ────────────────────────────────────────────────────────────────────

const WELCOME_EN = `👋 *Welcome aboard!*

I'm *Cashflow Manager* — your business finance assistant. I help small and medium businesses keep track of money the easy way: no spreadsheets, no paperwork, no app to learn.

✨ *How it works*

The moment money moves — a sale, an expense, a payment — just tell me. Speak or type, however you like:

📥 *Logging income / expense*
• \`sold for 1,200,000 today\`
• \`spent 350k on logistics yesterday\`
• 🎤 Or send a voice note — I understand Uzbek, Russian, and English

I'll record everything: amount, type, category, date — then confirm what I saved so you can trust the numbers.

📊 *Asking about your numbers*
• \`how much did we earn this week?\`
• \`what did we spend on rent in March?\`

🛠 *Commands*
/report — quick summary of this month
/undo — delete the last entry
/lang — change language
/help — show this anytime

🌐 [Open the dashboard](${dashboardUrl}) to see charts, trends, runway, and your full transaction history.

Ready when you are. Try logging your first transaction now ✨`;

const WELCOME_UZ = `👋 *Xush kelibsiz!*

Men — *Cashflow Manager*, biznesingiz uchun moliya yordamchisiman. Kichik va o'rta bizneslarga pulni oson hisobga olishda yordam beraman: jadvalsiz, qog'ozsiz, o'rganadigan ilovasiz.

✨ *Qanday ishlaydi?*

Pul harakatlanishi bilanoq — sotuv bo'ldimi, xarajat qildingizmi, to'lov keldimi — menga ayting. Ovoz yoki matn — qaysi qulay bo'lsa:

📥 *Kirim/chiqimni yozish*
• \`sotuvdan 1 200 000 keldi bugun\`
• \`kecha logistikaga 350 ming sarfladim\`
• 🎤 Yoki ovozli xabar yuboring — o'zbek, rus va ingliz tillarini tushunaman

Hammasini yozib qo'yaman: summa, turi, kategoriya, sana — keyin saqlangan ma'lumotni tasdiqlayman, raqamlarga ishonsangiz bo'ladi.

📊 *Ma'lumotlarni so'rash*
• \`bu oyda qancha topdik?\`
• \`mart oyida ijaraga qancha sarfladik?\`

🛠 *Buyruqlar*
/report — joriy oy hisoboti
/undo — oxirgi yozuvni o'chirish
/lang — tilni o'zgartirish
/help — yordamni ko'rsatish

🌐 [Boshqaruv panelini oching](${dashboardUrl}) — grafiklar, tendensiyalar, pul yetishi va to'liq tranzaksiyalar tarixi.

Tayyor bo'lganingizda boshlang. Birinchi yozuvingizni hozir sinab ko'ring ✨`;

const WELCOME_RU = `👋 *Добро пожаловать!*

Я — *Cashflow Manager*, ваш финансовый помощник для бизнеса. Помогаю малому и среднему бизнесу легко вести учёт денег: без таблиц, без бумаг, без приложения, которое надо изучать.

✨ *Как это работает*

Как только деньги движутся — продажа, расход, поступление — просто скажите мне. Голосом или текстом, как удобнее:

📥 *Записать приход / расход*
• \`продал на 1 200 000 сегодня\`
• \`потратил 350к на логистику вчера\`
• 🎤 Или отправьте голосовое — понимаю узбекский, русский и английский

Я запишу всё: сумму, тип, категорию, дату — и подтвержу сохранённое, чтобы вы могли доверять цифрам.

📊 *Спросить про ваши цифры*
• \`сколько заработали в этом месяце?\`
• \`сколько потратили на аренду в марте?\`

🛠 *Команды*
/report — сводка по текущему месяцу
/undo — удалить последнюю запись
/lang — сменить язык
/help — показать это сообщение

🌐 [Открыть панель](${dashboardUrl}) — графики, тренды, запас денег и полная история транзакций.

Готовы начать? Попробуйте записать первую транзакцию прямо сейчас ✨`;

export function welcomeMessage(lang: Lang): string {
  if (lang === "uz") return WELCOME_UZ;
  if (lang === "ru") return WELCOME_RU;
  return WELCOME_EN;
}

// ────────────────────────────────────────────────────────────────────
// Help message (shown on /help) — concise reference card, not a welcome
// ────────────────────────────────────────────────────────────────────

const HELP_EN = `🛠 *Quick reference*

📥 *Log a transaction*
• \`sold for 1,200,000 today\`
• \`spent 350k on logistics yesterday\`
• 🎤 Voice notes work in any language

📊 *Ask about your numbers*
• \`how much did we earn this week?\`
• \`what did we spend on rent in March?\`
• \`how much from sales this month?\`

✏️ *Fix the last entry*
• \`no, it was 500k not 250\`
• \`actually that was rent not utilities\`
• \`delete that\` — or tap 🗑 under the saved message

🆕 *New categories on the fly*
• \`add a category called Subscriptions for expenses\`
• \`create category Truck Rental (expense)\`

🛠 *Commands*
/start — welcome screen
/report — this month's summary
/categories — list all categories
/undo — delete the last entry
/lang — change language
/help — this card

🌐 [Open dashboard](${dashboardUrl})`;

const HELP_UZ = `🛠 *Qisqacha qo'llanma*

📥 *Tranzaksiya yozish*
• \`sotuvdan 1 200 000 keldi bugun\`
• \`kecha logistikaga 350 ming sarfladim\`
• 🎤 Ovozli xabarlar — istalgan tilda

📊 *Ma'lumotlarni so'rash*
• \`bu hafta qancha topdik?\`
• \`mart oyida ijaraga qancha sarfladik?\`
• \`bu oyda sotuvdan qancha?\`

✏️ *Oxirgi yozuvni o'zgartirish*
• \`yo'q, 500 ming edi, 250 emas\`
• \`aslida ijara edi, kommunal emas\`
• \`o'chir\` — yoki saqlangan xabar ostidagi 🗑 ni bosing

🆕 *Yangi kategoriya qo'shish*
• \`yangi kategoriya: Obuna (chiqim)\`
• \`yangi kategoriya qo'sh: Yuk mashina (chiqim)\`

🛠 *Buyruqlar*
/start — boshlash sahifasi
/report — joriy oy hisoboti
/categories — barcha kategoriyalar
/undo — oxirgi yozuvni o'chirish
/lang — tilni o'zgartirish
/help — bu qo'llanma

🌐 [Boshqaruv panelini oching](${dashboardUrl})`;

const HELP_RU = `🛠 *Краткая шпаргалка*

📥 *Записать транзакцию*
• \`продал на 1 200 000 сегодня\`
• \`потратил 350к на логистику вчера\`
• 🎤 Голосовые — на любом языке

📊 *Спросить про цифры*
• \`сколько заработали на этой неделе?\`
• \`сколько потратили на аренду в марте?\`
• \`сколько с продаж в этом месяце?\`

✏️ *Исправить последнюю запись*
• \`нет, 500к, а не 250\`
• \`это была аренда, не коммуналка\`
• \`удали\` — или нажмите 🗑 под сохранённым сообщением

🆕 *Создать новую категорию*
• \`создай категорию Подписки (расход)\`
• \`добавь категорию: Аренда грузовика (расход)\`

🛠 *Команды*
/start — приветствие
/report — сводка за месяц
/categories — список категорий
/undo — удалить последнюю запись
/lang — сменить язык
/help — эта шпаргалка

🌐 [Открыть панель](${dashboardUrl})`;

export function helpMessage(lang: Lang): string {
  if (lang === "uz") return HELP_UZ;
  if (lang === "ru") return HELP_RU;
  return HELP_EN;
}

// ────────────────────────────────────────────────────────────────────
// Misc strings used by the handler
// ────────────────────────────────────────────────────────────────────

const STRINGS: Record<Lang, Strings> = {
  en: {
    welcome: WELCOME_EN,
    help: WELCOME_EN,
    noLast: "I don't have a recent transaction to change.",
    cantUnderstand: "I didn't catch that. Could you rephrase?",
    edited: (when) => `Updated for ${when}.`,
    deleted: (cat, amount) => `Deleted: ${amount} (${cat}).`,
    saved: "Saved.",
    whatNext: { edit: "✏️ Edit", delete: "🗑 Delete", dashboard: "📊 Dashboard" },
    cantParse: "Sorry — I had trouble understanding that. Try a shorter sentence, or use the dashboard.",
    reportEmpty: "Nothing recorded yet for this period.",
    langChanged: "✓ Language set to English.",
  },
  uz: {
    welcome: WELCOME_UZ,
    help: WELCOME_UZ,
    noLast: "Yaqinda saqlangan tranzaksiya topilmadi.",
    cantUnderstand: "Tushuna olmadim. Iltimos, qaytadan ayting.",
    edited: (when) => `Yangilandi (${when}).`,
    deleted: (cat, amount) => `O'chirildi: ${amount} (${cat}).`,
    saved: "Saqlandi.",
    whatNext: { edit: "✏️ O'zgartirish", delete: "🗑 O'chirish", dashboard: "📊 Panel" },
    cantParse: "Kechirasiz, tushuna olmadim. Qisqaroq aytib ko'ring yoki paneldan foydalaning.",
    reportEmpty: "Bu davr uchun hozircha yozuv yo'q.",
    langChanged: "✓ Til o'zbekchaga o'zgartirildi.",
  },
  ru: {
    welcome: WELCOME_RU,
    help: WELCOME_RU,
    noLast: "Не нашёл недавно сохранённую запись.",
    cantUnderstand: "Не понял. Сформулируйте, пожалуйста, иначе.",
    edited: (when) => `Обновлено (${when}).`,
    deleted: (cat, amount) => `Удалено: ${amount} (${cat}).`,
    saved: "Сохранил.",
    whatNext: { edit: "✏️ Изменить", delete: "🗑 Удалить", dashboard: "📊 Панель" },
    cantParse: "Извините, не разобрал. Попробуйте короче или откройте панель.",
    reportEmpty: "За этот период пока ничего нет.",
    langChanged: "✓ Язык изменён на русский.",
  },
};

export function strings(lang: Lang): Strings {
  return STRINGS[lang];
}

// Map Telegram language_code to our supported set. Telegram returns ISO 639-1
// like "ru", "en", "uz", sometimes with region "en-US".
export function mapTelegramLang(code: string | undefined | null): Lang {
  if (!code) return "en";
  const base = code.toLowerCase().split("-")[0];
  if (base === "uz") return "uz";
  if (base === "ru" || base === "kk" || base === "ky" || base === "tg") return "ru";
  return "en";
}
