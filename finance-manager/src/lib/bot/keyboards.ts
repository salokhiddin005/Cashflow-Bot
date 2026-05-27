import type { Category, Lang } from "../db/types";
import type { InlineButton } from "./handler";

// ────────────────────────────────────────────────────────────────────
// Main menu (persistent reply keyboard) — always visible at the bottom
// ────────────────────────────────────────────────────────────────────

export const MAIN_MENU_LABELS: Record<Lang, {
  add: string;
  report: string;
  recent: string;
  categories: string;
  help: string;
}> = {
  en: { add: "➕ Add",      report: "📊 Report",   recent: "📋 Recent",  categories: "📂 Categories",   help: "ℹ️ Help" },
  uz: { add: "➕ Qo'shish", report: "📊 Hisobot",  recent: "📋 Yozuvlar", categories: "📂 Kategoriyalar", help: "ℹ️ Yordam" },
  ru: { add: "➕ Добавить", report: "📊 Отчёт",    recent: "📋 Записи",   categories: "📂 Категории",     help: "ℹ️ Помощь" },
};

// Persistent button grid. Five buttons in 3 rows so they fit nicely on phones.
export function mainMenuLayout(lang: Lang): string[][] {
  const m = MAIN_MENU_LABELS[lang];
  return [
    [m.add, m.report],
    [m.recent, m.categories],
    [m.help],
  ];
}

// True if `text` matches one of the main-menu button labels in *any* language.
// Returns the canonical action key, or null. Lets users switch language and
// still tap the same buttons.
export function matchMenuTap(text: string): "add" | "report" | "recent" | "categories" | "help" | null {
  const t = text.trim();
  for (const lang of ["en", "uz", "ru"] as Lang[]) {
    const m = MAIN_MENU_LABELS[lang];
    if (t === m.add)        return "add";
    if (t === m.report)     return "report";
    if (t === m.recent)     return "recent";
    if (t === m.categories) return "categories";
    if (t === m.help)       return "help";
  }
  return null;
}

// Row(s) of numbered delete buttons (🗑 1) (🗑 2) ... below a "recent list" message.
// Tap → confirmation step (delc:<txId>) → confirm → final delete (delconf:<txId>).
export function recentDeleteButtonsInline(transactionIds: number[]): InlineButton[][] {
  const rows: InlineButton[][] = [];
  for (let i = 0; i < transactionIds.length; i += 3) {
    const row: InlineButton[] = [];
    for (let j = i; j < Math.min(i + 3, transactionIds.length); j++) {
      row.push({
        text: `🗑 ${j + 1}`,
        callbackData: `delc:${transactionIds[j]}`,
      });
    }
    rows.push(row);
  }
  return rows;
}

// ────────────────────────────────────────────────────────────────────
// Report period picker
// ────────────────────────────────────────────────────────────────────

// Picker keys correspond to buttons on the picker menu.
export type ReportPeriodKey =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "ytd"
  | "custom";

// Navigation keys are the underlying *units* the user steps through with
// ◀/▶. (today/yesterday both step by day; this_week/last_week step by week;
// etc.) Keeping these separate from picker keys lets us nav uniformly.
export type NavPeriodKey = "day" | "week" | "month" | "ytd";

export function reportPeriodPickerInline(lang: Lang): InlineButton[][] {
  const labels =
    lang === "uz" ? {
      today: "📅 Bugun",          yesterday: "🕐 Kecha",
      this_week: "📆 Bu hafta",   last_week: "⏪ O'tgan hafta",
      this_month: "📅 Bu oy",     last_month: "⏪ O'tgan oy",
      ytd: "📊 Yil boshidan",     custom: "✏️ Boshqa sana",
    }
    : lang === "ru" ? {
      today: "📅 Сегодня",        yesterday: "🕐 Вчера",
      this_week: "📆 Эта неделя", last_week: "⏪ Прошлая неделя",
      this_month: "📅 Этот месяц",last_month: "⏪ Прошлый месяц",
      ytd: "📊 С начала года",    custom: "✏️ Другая дата",
    }
    : {
      today: "📅 Today",          yesterday: "🕐 Yesterday",
      this_week: "📆 This week",  last_week: "⏪ Last week",
      this_month: "📅 This month",last_month: "⏪ Last month",
      ytd: "📊 Year to date",     custom: "✏️ Pick a date",
    };
  return [
    [{ text: labels.today,      callbackData: "rep:today" },      { text: labels.yesterday, callbackData: "rep:yesterday" }],
    [{ text: labels.this_week,  callbackData: "rep:this_week" },  { text: labels.last_week, callbackData: "rep:last_week" }],
    [{ text: labels.this_month, callbackData: "rep:this_month" }, { text: labels.last_month,callbackData: "rep:last_month" }],
    [{ text: labels.ytd,        callbackData: "rep:ytd" },        { text: labels.custom,    callbackData: "rep:custom" }],
  ];
}

// Nav row at the bottom of every report: [◀ Prev] [📅 Pick] [Next ▶].
// `refDate` is any ISO date inside the current period (used for prev/next math).
export function reportNavInline(navKey: NavPeriodKey, refDate: string, lang: Lang, opts: { canNext: boolean }): InlineButton[][] {
  const labels =
    lang === "uz" ? { prev: "◀️ Avval",  pick: "📅 Boshqa davr", next: "Keyin ▶️" }
    : lang === "ru" ? { prev: "◀️ Назад", pick: "📅 Другой период", next: "Вперёд ▶️" }
    : { prev: "◀️ Prev", pick: "📅 Pick another", next: "Next ▶️" };
  // YTD has a fixed range, no meaningful navigation.
  if (navKey === "ytd") {
    return [[{ text: labels.pick, callbackData: "rep:menu" }]];
  }
  const row: InlineButton[] = [
    { text: labels.prev, callbackData: `rep:nav:prev:${navKey}:${refDate}` },
    { text: labels.pick, callbackData: "rep:menu" },
  ];
  if (opts.canNext) {
    row.push({ text: labels.next, callbackData: `rep:nav:next:${navKey}:${refDate}` });
  }
  return [row];
}

// Confirmation buttons: shown after tapping 🗑 in the Recent list.
export function confirmDeleteTxInline(txId: number, lang: Lang): InlineButton[][] {
  const labels =
    lang === "uz" ? { yes: "🗑 Ha, o'chirish", no: "✗ Bekor qilish" }
    : lang === "ru" ? { yes: "🗑 Да, удалить", no: "✗ Отмена" }
    : { yes: "🗑 Yes, delete", no: "✗ Cancel" };
  return [[
    { text: labels.yes, callbackData: `delconf:${txId}` },
    { text: labels.no,  callbackData: "delcancel" },
  ]];
}

// ────────────────────────────────────────────────────────────────────
// Inline keyboards (attached to specific bot messages, send callback_data)
// ────────────────────────────────────────────────────────────────────

export function kindPickerInline(lang: Lang): InlineButton[][] {
  const labels =
    lang === "uz" ? { income: "💰 Kirim", expense: "💸 Chiqim", cancel: "✗ Bekor qilish" }
    : lang === "ru" ? { income: "💰 Доход", expense: "💸 Расход", cancel: "✗ Отмена" }
    : { income: "💰 Income", expense: "💸 Expense", cancel: "✗ Cancel" };
  return [
    [
      { text: labels.income,  callbackData: "wiz:kind:income"  },
      { text: labels.expense, callbackData: "wiz:kind:expense" },
    ],
    [{ text: labels.cancel, callbackData: "wiz:cancel" }],
  ];
}

// Preset amounts (in UZS). The "Custom" button tells the user to type the amount.
const PRESET_AMOUNTS = [100_000, 500_000, 1_000_000, 5_000_000];

export function amountPickerInline(lang: Lang): InlineButton[][] {
  const customLabel =
    lang === "uz" ? "✏️ Boshqa summa"
    : lang === "ru" ? "✏️ Другая сумма"
    : "✏️ Other amount";
  const cancel =
    lang === "uz" ? "✗ Bekor qilish"
    : lang === "ru" ? "✗ Отмена"
    : "✗ Cancel";
  const fmt = (n: number) =>
    n >= 1_000_000 ? `${n / 1_000_000}M`
    : `${n / 1_000}K`;
  const rows: InlineButton[][] = [];
  for (let i = 0; i < PRESET_AMOUNTS.length; i += 2) {
    const row: InlineButton[] = [];
    for (let j = i; j < Math.min(i + 2, PRESET_AMOUNTS.length); j++) {
      const v = PRESET_AMOUNTS[j];
      row.push({ text: fmt(v), callbackData: `wiz:amt:${v}` });
    }
    rows.push(row);
  }
  rows.push([{ text: customLabel, callbackData: "wiz:amt:custom" }]);
  rows.push([{ text: cancel, callbackData: "wiz:cancel" }]);
  return rows;
}

export function categoryPickerInline(categories: Category[], kind: "income" | "expense", lang: Lang): InlineButton[][] {
  const filtered = categories.filter((c) => c.kind === kind && !c.is_archived);
  const cancel =
    lang === "uz" ? "✗ Bekor qilish"
    : lang === "ru" ? "✗ Отмена"
    : "✗ Cancel";
  const labelOf = (c: Category) =>
    lang === "uz" ? c.label_uz : lang === "ru" ? c.label_ru : c.label_en;
  const rows: InlineButton[][] = [];
  for (let i = 0; i < filtered.length; i += 2) {
    const row: InlineButton[] = [];
    for (let j = i; j < Math.min(i + 2, filtered.length); j++) {
      row.push({ text: labelOf(filtered[j]), callbackData: `wiz:cat:${filtered[j].id}` });
    }
    rows.push(row);
  }
  rows.push([{ text: cancel, callbackData: "wiz:cancel" }]);
  return rows;
}

export function datePickerInline(lang: Lang): InlineButton[][] {
  const labels =
    lang === "uz" ? { today: "📅 Bugun", yest: "🕐 Kecha", custom: "✏️ Boshqa sana", cancel: "✗ Bekor qilish" }
    : lang === "ru" ? { today: "📅 Сегодня", yest: "🕐 Вчера", custom: "✏️ Другая дата", cancel: "✗ Отмена" }
    : { today: "📅 Today", yest: "🕐 Yesterday", custom: "✏️ Other date", cancel: "✗ Cancel" };
  return [
    [{ text: labels.today, callbackData: "wiz:date:today" }, { text: labels.yest, callbackData: "wiz:date:yesterday" }],
    [{ text: labels.custom, callbackData: "wiz:date:custom" }],
    [{ text: labels.cancel, callbackData: "wiz:cancel" }],
  ];
}

export function noteSkipInline(lang: Lang): InlineButton[][] {
  const labels =
    lang === "uz" ? { skip: "⏭ O'tkazib yuborish", cancel: "✗ Bekor qilish" }
    : lang === "ru" ? { skip: "⏭ Пропустить", cancel: "✗ Отмена" }
    : { skip: "⏭ Skip", cancel: "✗ Cancel" };
  return [
    [{ text: labels.skip, callbackData: "wiz:note:skip" }],
    [{ text: labels.cancel, callbackData: "wiz:cancel" }],
  ];
}

export function confirmSaveInline(lang: Lang): InlineButton[][] {
  const labels =
    lang === "uz" ? { yes: "✅ Saqlash", no: "✗ Bekor qilish" }
    : lang === "ru" ? { yes: "✅ Сохранить", no: "✗ Отмена" }
    : { yes: "✅ Save", no: "✗ Cancel" };
  return [
    [{ text: labels.yes, callbackData: "wiz:save" }, { text: labels.no, callbackData: "wiz:cancel" }],
  ];
}

// Generic "Are you sure?" inline keyboard for destructive ops.
// `target` is whatever follow-up callback we want when user confirms.
export function confirmDeleteInline(lang: Lang, confirmCallback: string): InlineButton[][] {
  const labels =
    lang === "uz" ? { yes: "🗑 Ha, o'chirish", no: "✗ Bekor qilish" }
    : lang === "ru" ? { yes: "🗑 Да, удалить", no: "✗ Отмена" }
    : { yes: "🗑 Yes, delete", no: "✗ Cancel" };
  return [
    [{ text: labels.yes, callbackData: confirmCallback }, { text: labels.no, callbackData: "wiz:cancel" }],
  ];
}

// ────────────────────────────────────────────────────────────────────
// Wizard prompts
// ────────────────────────────────────────────────────────────────────

export function wizardPrompts(lang: Lang) {
  if (lang === "uz") return {
    chooseKind: "*Yangi yozuv*\n\nQanday tranzaksiya?",
    chooseAmount: "💰 *Summa*\n\nBir tugmani tanlang yoki summani yozing (UZS):",
    typeAmount: "✏️ Summani yozing (UZS):",
    chooseCategory: "📂 *Kategoriya*\n\nQaysi kategoriyaga tegishli?",
    chooseDate: "📅 *Sana*\n\nQachon bo'lgan?",
    typeDate: "✏️ Sanani YYYY-MM-DD shaklida yozing (masalan, 2026-04-15):",
    addNote: "📝 *Izoh* (ixtiyoriy)\n\nIzoh qoldirasizmi yoki o'tkazib yuborasizmi?",
    confirm: (summary: string) => `*Tasdiqlang*\n\n${summary}\n\nSaqlaymizmi?`,
    cancelled: "Bekor qilindi.",
    saved: "✅ Saqlandi!",
    invalidAmount: "Summa noto'g'ri. Faqat raqam kiriting (masalan, 350000).",
    invalidDate: "Sana noto'g'ri. YYYY-MM-DD shaklida yozing (masalan, 2026-04-15).",
  };
  if (lang === "ru") return {
    chooseKind: "*Новая запись*\n\nКакого типа транзакция?",
    chooseAmount: "💰 *Сумма*\n\nВыберите кнопку или напишите сумму (UZS):",
    typeAmount: "✏️ Напишите сумму (UZS):",
    chooseCategory: "📂 *Категория*\n\nК какой категории относится?",
    chooseDate: "📅 *Дата*\n\nКогда это было?",
    typeDate: "✏️ Напишите дату в формате ГГГГ-ММ-ДД (например, 2026-04-15):",
    addNote: "📝 *Заметка* (необязательно)\n\nДобавите заметку или пропустить?",
    confirm: (summary: string) => `*Подтвердите*\n\n${summary}\n\nСохранить?`,
    cancelled: "Отменено.",
    saved: "✅ Сохранено!",
    invalidAmount: "Неверная сумма. Введите только число (например, 350000).",
    invalidDate: "Неверная дата. Используйте формат ГГГГ-ММ-ДД (например, 2026-04-15).",
  };
  return {
    chooseKind: "*New transaction*\n\nWhat kind?",
    chooseAmount: "💰 *Amount*\n\nTap a button or type an amount (UZS):",
    typeAmount: "✏️ Type the amount (UZS):",
    chooseCategory: "📂 *Category*\n\nWhich category does this belong to?",
    chooseDate: "📅 *Date*\n\nWhen did this happen?",
    typeDate: "✏️ Type the date as YYYY-MM-DD (e.g., 2026-04-15):",
    addNote: "📝 *Note* (optional)\n\nAdd a note or skip?",
    confirm: (summary: string) => `*Confirm*\n\n${summary}\n\nSave it?`,
    cancelled: "Cancelled.",
    saved: "✅ Saved!",
    invalidAmount: "That doesn't look like a valid amount. Type just a number (e.g., 350000).",
    invalidDate: "That date doesn't look right. Use YYYY-MM-DD (e.g., 2026-04-15).",
  };
}
