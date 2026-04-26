import { revalidatePath } from "next/cache";
import { format, parseISO } from "date-fns";
import {
  categoryTotalBetween,
  createCategory,
  createTransaction,
  deleteCategory,
  deleteTransaction,
  generateUniqueCategoryKey,
  getCategoryByKey,
  getTransaction,
  getUserLanguage,
  listCategories,
  listTransactions,
  setUserLanguage,
  totalsBetween,
  upsertTelegramUser,
  updateTransaction,
} from "../db/queries";
import { computeRunway } from "../insights";
import { publish } from "../events";
import { detectLanguage } from "../i18n";
import { formatMoney } from "../format";
import { transcribeAudio } from "./voice";
import { parseIntent, type LogIntent, type ParsedIntent } from "./intent";
import { getChatState, setLastTransaction, setPendingIntent } from "./state";
import {
  matchMenuTap,
  recentDeleteButtonsInline,
  reportNavInline,
  reportPeriodPickerInline,
  type NavPeriodKey,
  type ReportPeriodKey,
} from "./keyboards";
import { handleWizardText, isWizardState, startLogWizard, type WizardState } from "./wizard";
import {
  LANGUAGE_PICKER_BUTTONS,
  LANGUAGE_PICKER_TEXT,
  helpMessage,
  mapTelegramLang,
  strings,
  welcomeMessage,
} from "./welcome";
import type { Lang } from "../db/types";

export type IncomingMessage = {
  chat_id: number;
  user: { telegram_id: number; username?: string | null; first_name?: string | null; last_name?: string | null; language_code?: string | null };
  text?: string;
  voice?: { buffer: Buffer; mime_type?: string };
};

export type InlineButton = { text: string; callbackData?: string; url?: string };
export type BotReply = {
  text: string;
  inlineKeyboard?: InlineButton[][];
};

const _RAW_URL = (process.env.APP_BASE_URL?.trim() || "").replace(/\/$/, "");
// Telegram inline URL buttons must be HTTPS — drop the link in local dev.
const DASHBOARD_URL: string | null = /^https:\/\//.test(_RAW_URL) ? _RAW_URL : null;

function dashboardButton(label: string): InlineButton[] {
  return DASHBOARD_URL ? [{ text: label, url: DASHBOARD_URL }] : [];
}

export function languagePickerReply(): BotReply {
  return {
    text: LANGUAGE_PICKER_TEXT,
    inlineKeyboard: [LANGUAGE_PICKER_BUTTONS.map((b) => ({ text: b.text, callbackData: b.callbackData }))],
  };
}

export async function handleIncoming(msg: IncomingMessage): Promise<BotReply> {
  // Persist user as soon as we see them — even if processing fails later.
  // Don't overwrite a saved language preference with the Telegram default.
  const savedLang = await getUserLanguage(msg.user.telegram_id);
  const tgUser = await upsertTelegramUser({
    telegram_id: msg.user.telegram_id,
    username: msg.user.username ?? null,
    first_name: msg.user.first_name ?? null,
    last_name: msg.user.last_name ?? null,
    language_code: savedLang ?? mapTelegramLang(msg.user.language_code),
  });

  // Resolve the user's preferred language: explicit DB choice > Telegram app
  // language > English fallback. The LLM can still detect per-message language
  // for free-form messages where the user mixes languages.
  const userLang: Lang = savedLang ?? mapTelegramLang(msg.user.language_code);

  let text = msg.text?.trim() ?? "";

  if (msg.voice) {
    try {
      text = (await transcribeAudio(msg.voice.buffer)).trim();
    } catch (e) {
      console.error("transcription failed", e);
      return { text: strings(userLang).cantParse };
    }
  }

  if (!text) {
    return { text: strings(userLang).cantUnderstand };
  }

  // ── Multi-turn flows take precedence ─────────────────────────────────
  // If we're in the middle of a wizard (e.g. add-transaction step-by-step)
  // or waiting on a custom report date, route this text message through
  // the appropriate handler before anything else.
  const earlyState = await getChatState(msg.chat_id);
  if (earlyState?.pending_intent) {
    try {
      const pending = JSON.parse(earlyState.pending_intent);
      // Allow /cancel to bail out of any pending state.
      if (/^\/cancel\b/i.test(text) || /^cancel$/i.test(text)) {
        setPendingIntent(msg.chat_id, null);
      } else if (isWizardState(pending)) {
        return handleWizardText(msg.chat_id, text, pending as WizardState, tgUser.id);
      } else if (pending?.type === "report_date_input") {
        setPendingIntent(msg.chat_id, null);
        const trimmed = text.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          // Re-arm and ask again with a clearer hint.
          setPendingIntent(msg.chat_id, { type: "report_date_input" });
          return { text: invalidDateMessage(userLang) };
        }
        return renderReport({ navKey: "day", refDate: trimmed, language: userLang });
      }
    } catch {
      // Bad JSON in pending — clear it.
      setPendingIntent(msg.chat_id, null);
    }
  }

  // ── Persistent menu button taps (translated to actions) ──────────────
  const menuAction = matchMenuTap(text);
  if (menuAction === "add")        return startLogWizard(msg.chat_id, userLang);
  if (menuAction === "report")     return doReportPicker(userLang);
  if (menuAction === "recent")     return doListRecent(userLang);
  if (menuAction === "categories") return doListCategories(userLang);
  if (menuAction === "help")       return { text: helpMessage(userLang) };

  // Built-in commands handled without an LLM call (faster, free, predictable).
  // /start: first-timers (no saved lang) get the language picker; returning
  // users get a friendly welcome in their chosen language. /lang always shows
  // the picker so they can switch.
  if (/^\/start\b/i.test(text)) {
    if (!savedLang) return languagePickerReply();
    return { text: welcomeMessage(userLang) };
  }
  if (/^\/add\b/i.test(text)) {
    return startLogWizard(msg.chat_id, userLang);
  }
  if (/^\/lang\b/i.test(text)) {
    return languagePickerReply();
  }
  if (/^\/help\b/i.test(text)) {
    return { text: helpMessage(userLang) };
  }
  if (/^\/report\b/i.test(text)) {
    return doReportPicker(userLang);
  }
  if (/^\/undo\b/i.test(text) || /^\/cancel\b/i.test(text)) {
    return doDeleteLast({ language: userLang }, msg.chat_id);
  }
  if (/^\/categories\b/i.test(text) || /^\/categs\b/i.test(text)) {
    return doListCategories(userLang);
  }

  const categories = await listCategories({ includeArchived: false });
  const state = await getChatState(msg.chat_id);

  // Multi-turn flow: if the bot was waiting for a follow-up (e.g. "income or
  // expense?" after a create_category request), try to complete that intent
  // before re-asking the LLM. Avoids losing context across turns.
  if (state?.pending_intent) {
    try {
      const pending = JSON.parse(state.pending_intent) as { type?: string } & Record<string, unknown>;
      if (pending.type === "create_category") {
        const kind = parseKindFromText(text);
        if (kind) {
          setPendingIntent(msg.chat_id, null);
          return doCreateCategory({
            type: "create_category",
            label_en: String(pending.label_en ?? text),
            label_uz: String(pending.label_uz ?? text),
            label_ru: String(pending.label_ru ?? text),
            kind,
            language: (pending.language as Lang) ?? userLang,
            confirmation: "",
            followup_question: null,
          }, msg.chat_id);
        }
        // User said something else — abandon the pending state and process normally.
        setPendingIntent(msg.chat_id, null);
      }
    } catch {
      setPendingIntent(msg.chat_id, null);
    }
  }

  let parsed: ParsedIntent;
  try {
    parsed = await parseIntent(text, categories, {
      hasLastTransaction: !!state?.last_transaction_id,
    });
  } catch (e) {
    console.error("intent parse failed", e);
    const lang = detectLanguage(text) || userLang;
    // Surface rate-limit errors clearly (Gemini free tier has per-minute caps).
    const msg = e instanceof Error ? e.message : String(e);
    if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) {
      return { text: rateLimitedMessage(lang) };
    }
    return { text: strings(lang).cantParse };
  }

  switch (parsed.type) {
    case "smalltalk":
      return { text: parsed.reply };

    case "log":
      return await doLog(parsed, msg.chat_id, tgUser.id);

    case "report":
      return await doReport(parsed);

    case "edit_last":
      return await doEditLast(parsed, msg.chat_id);

    case "delete_last":
      return await doDeleteLast(parsed, msg.chat_id);

    case "create_category":
      return await doCreateCategory(parsed, msg.chat_id);

    case "delete_category":
      return await doDeleteCategory(parsed);

    case "show_picker":
      return doReportPicker(parsed.language);

    case "show_recent":
      return await doListRecent(parsed.language);

    case "change_language":
      return await doChangeLanguage(parsed.target_language, msg.user.telegram_id);
  }
}

async function doLog(intent: LogIntent, chatId: number, telegramUserId: number): Promise<BotReply> {
  if (intent.followup_question) {
    // Don't save — bot is asking for clarification.
    return { text: intent.followup_question };
  }

  // Amount is required to save. If LLM didn't extract one, ask for it.
  if (intent.amount == null || intent.amount <= 0) {
    return { text: askForAmount(intent.language, intent.kind) };
  }

  const cat = intent.category_key
    ? await getCategoryByKey(intent.category_key)
    : await getCategoryByKey(intent.kind === "income" ? "other_income" : "other_expense");

  const category =
    cat ?? (await getCategoryByKey(intent.kind === "income" ? "other_income" : "other_expense"));

  if (!category || category.kind !== intent.kind) {
    return { text: strings(intent.language).cantUnderstand };
  }

  const tx = await createTransaction({
    kind: intent.kind,
    amount: intent.amount,
    category_id: category.id,
    occurred_on: intent.occurred_on,
    note: intent.note,
    source: "telegram",
    telegram_user_id: telegramUserId,
  });
  await setLastTransaction(chatId, tx.id);

  // Trigger dashboard refresh on next view.
  try {
    revalidatePath("/");
    revalidatePath("/transactions");
    revalidatePath("/analytics");
  } catch {
    // revalidatePath outside request scope can throw — safe to ignore.
  }
  publish("transaction:created", { source: "telegram", payload: { id: tx.id } });

  // Fall back to a synthesized confirmation if the LLM omitted one.
  let body = intent.confirmation?.trim()
    ? intent.confirmation
    : synthesizeLogConfirmation(intent.language, intent.kind, intent.amount, category.label_en, intent.occurred_on);
  if (intent.category_confidence === "low") {
    body += "\n\n" + nudgeAboutCategory(intent.language);
  }

  const s = strings(intent.language);
  return {
    text: body,
    inlineKeyboard: [[
      { text: s.whatNext.delete, callbackData: `del:${tx.id}` },
      ...dashboardButton(s.whatNext.dashboard),
    ]],
  };
}

// ────────────────────────────────────────────────────────────────────
// Reports — picker → render → navigate
// ────────────────────────────────────────────────────────────────────

const TODAY_ISO = () => format(new Date(), "yyyy-MM-dd");

// Compute the date range for a navigation period anchored at `refDate`.
function rangeFor(navKey: NavPeriodKey, refDate: string, lang: Lang): { from: string; to: string; label: string; canNext: boolean } {
  const ref = parseISO(refDate);
  const today = TODAY_ISO();
  const todayDate = parseISO(today);

  if (navKey === "day") {
    const label =
      refDate === today
        ? (lang === "uz" ? `Bugun (${format(ref, "d MMM")})` : lang === "ru" ? `Сегодня (${format(ref, "d MMM")})` : `Today (${format(ref, "d MMM")})`)
        : format(ref, "EEEE, d MMM yyyy");
    return { from: refDate, to: refDate, label, canNext: refDate < today };
  }

  if (navKey === "week") {
    const dow = ref.getDay() === 0 ? 6 : ref.getDay() - 1; // Mon=0
    const monday = new Date(ref); monday.setDate(ref.getDate() - dow);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const from = format(monday, "yyyy-MM-dd");
    const to   = format(sunday, "yyyy-MM-dd");
    const label = `${format(monday, "d MMM")} – ${format(sunday, "d MMM yyyy")}`;
    // Inline today's-week Monday to avoid a recursive call back into rangeFor.
    const todayDow = todayDate.getDay() === 0 ? 6 : todayDate.getDay() - 1;
    const todayMonday = new Date(todayDate); todayMonday.setDate(todayDate.getDate() - todayDow);
    const todayMondayStr = format(todayMonday, "yyyy-MM-dd");
    return { from, to, label, canNext: from < todayMondayStr };
  }

  if (navKey === "month") {
    const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const last  = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    const from = format(first, "yyyy-MM-dd");
    const to   = format(last,  "yyyy-MM-dd");
    const label = format(first, "MMMM yyyy");
    // Inline today's month start (no recursion).
    const todayMonthStart = format(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1), "yyyy-MM-dd");
    return { from, to, label, canNext: from < todayMonthStart };
  }

  // ytd
  const first = new Date(ref.getFullYear(), 0, 1);
  return {
    from: format(first, "yyyy-MM-dd"),
    to: today,
    label: `${ref.getFullYear()} YTD`,
    canNext: false,
  };
}

// Step the refDate forward or backward by one period unit.
export function navStep(navKey: NavPeriodKey, refDate: string, dir: "prev" | "next"): string {
  const ref = parseISO(refDate);
  const sign = dir === "prev" ? -1 : 1;
  if (navKey === "day")   ref.setDate(ref.getDate() + sign);
  if (navKey === "week")  ref.setDate(ref.getDate() + sign * 7);
  if (navKey === "month") ref.setMonth(ref.getMonth() + sign);
  // ytd: no-op; nav is hidden for ytd anyway
  return format(ref, "yyyy-MM-dd");
}

// Map a picker selection to a (navKey, refDate) pair we can navigate from.
export function pickerToNav(picker: ReportPeriodKey): { navKey: NavPeriodKey; refDate: string } {
  const today = TODAY_ISO();
  switch (picker) {
    case "today":      return { navKey: "day",   refDate: today };
    case "yesterday":  return { navKey: "day",   refDate: navStep("day", today, "prev") };
    case "this_week":  return { navKey: "week",  refDate: today };
    case "last_week":  return { navKey: "week",  refDate: navStep("week", today, "prev") };
    case "this_month": return { navKey: "month", refDate: today };
    case "last_month": return { navKey: "month", refDate: navStep("month", today, "prev") };
    case "ytd":        return { navKey: "ytd",   refDate: today };
    case "custom":     return { navKey: "day",   refDate: today }; // overridden by user input
  }
}

export function doReportPicker(lang: Lang): BotReply {
  const heading =
    lang === "uz" ? "📊 *Hisobotlar*\n\nQaysi davr uchun?"
    : lang === "ru" ? "📊 *Отчёты*\n\nЗа какой период?"
    : "📊 *Reports*\n\nWhich period?";
  return {
    text: heading,
    inlineKeyboard: reportPeriodPickerInline(lang),
  };
}

// Render a report for a (navKey, refDate). Optionally filter to one category.
export async function renderReport(opts: {
  navKey: NavPeriodKey;
  refDate: string;
  language: Lang;
  categoryKey?: string | null;
}): Promise<BotReply> {
  const { navKey, refDate, language: lang } = opts;
  const { from, to, label, canNext } = rangeFor(navKey, refDate, lang);
  const s = strings(lang);
  const navKb = reportNavInline(navKey, refDate, lang, { canNext });

  // Category-filtered branch ("how much on logistics this month?")
  if (opts.categoryKey) {
    const cat = await getCategoryByKey(opts.categoryKey);
    if (cat) {
      const r = await categoryTotalBetween(cat.id, from, to);
      const sign = cat.kind === "income" ? "+" : "−";
      const verb =
        lang === "uz" ? (cat.kind === "income" ? "kirim" : "chiqim")
        : lang === "ru" ? (cat.kind === "income" ? "доход" : "расход")
        : (cat.kind === "income" ? "income" : "expense");
      const txWord =
        lang === "uz" ? "tranzaksiya"
        : lang === "ru" ? (r.count === 1 ? "транзакция" : "транзакций")
        : (r.count === 1 ? "transaction" : "transactions");
      const lines = [
        `📊 *${cat.label_en}* — ${label}`,
        "",
        `${sign} ${formatMoney(r.total)} (${verb})`,
        `${r.count} ${txWord}`,
      ];
      if (r.count === 0) lines.push("\n" + s.reportEmpty);
      return { text: lines.join("\n"), inlineKeyboard: navKb };
    }
  }

  // Overall report for the period.
  // Cash position is computed AS OF the period's end (not always today),
  // so historical reports show the balance the user actually had then.
  const [t, runway] = await Promise.all([
    totalsBetween(from, to),
    computeRunway({ asOfDate: to }),
  ]);
  const lines: string[] = [];
  const headerEmoji = navKey === "day" ? "📅" : navKey === "week" ? "📆" : navKey === "month" ? "🗓" : "📊";

  // Cash label depends on whether the period is in the past or includes today.
  const cashLabel =
    lang === "uz" ? (runway.isHistorical ? `💰 Davr oxiridagi balans` : "💰 Hozirgi balans")
    : lang === "ru" ? (runway.isHistorical ? `💰 Баланс на конец периода` : "💰 Текущий баланс")
    : (runway.isHistorical ? `💰 Cash at end of period` : "💰 Cash on hand");

  // For dates before the workspace started tracking, the cash balance is not
  // meaningful — show a "tracking hadn't started yet" line instead of the
  // raw starting_balance.
  const beforeTrackingLine =
    lang === "uz" ? "ℹ️ _Bu sanada hali kuzatuv boshlanmagan edi._"
    : lang === "ru" ? "ℹ️ _На этот день учёт ещё не начался._"
    : "ℹ️ _Tracking hadn't started yet on this date._";

  if (lang === "uz") {
    lines.push(`${headerEmoji} *${label}*`);
    lines.push("```");
    lines.push(`Kirim:    ${formatMoney(t.income).padStart(20)}`);
    lines.push(`Chiqim:   ${formatMoney(t.expense).padStart(20)}`);
    lines.push(`Sof:      ${(t.net >= 0 ? "+" : "−") + formatMoney(Math.abs(t.net)).padStart(19)}`);
    lines.push("```");
    lines.push("");
    if (runway.beforeTracking) {
      lines.push(beforeTrackingLine);
    } else {
      lines.push(`${cashLabel}: *${formatMoney(runway.currentBalance)}*`);
      // Forward-looking runway only makes sense when looking at the present.
      if (!runway.isHistorical && runway.monthsOfRunway != null && runway.burnRateMonthly > 0) {
        const e = runway.monthsOfRunway < 3 ? "⚠️" : runway.monthsOfRunway < 6 ? "🟡" : "🟢";
        lines.push(`${e} Yetadi: ~${runway.monthsOfRunway.toFixed(1)} oyga`);
      }
    }
  } else if (lang === "ru") {
    lines.push(`${headerEmoji} *${label}*`);
    lines.push("```");
    lines.push(`Доход:   ${formatMoney(t.income).padStart(20)}`);
    lines.push(`Расход:  ${formatMoney(t.expense).padStart(20)}`);
    lines.push(`Чистый:  ${(t.net >= 0 ? "+" : "−") + formatMoney(Math.abs(t.net)).padStart(19)}`);
    lines.push("```");
    lines.push("");
    if (runway.beforeTracking) {
      lines.push(beforeTrackingLine);
    } else {
      lines.push(`${cashLabel}: *${formatMoney(runway.currentBalance)}*`);
      if (!runway.isHistorical && runway.monthsOfRunway != null && runway.burnRateMonthly > 0) {
        const e = runway.monthsOfRunway < 3 ? "⚠️" : runway.monthsOfRunway < 6 ? "🟡" : "🟢";
        lines.push(`${e} Хватит на: ~${runway.monthsOfRunway.toFixed(1)} мес.`);
      }
    }
  } else {
    lines.push(`${headerEmoji} *${label}*`);
    lines.push("```");
    lines.push(`Income:   ${formatMoney(t.income).padStart(20)}`);
    lines.push(`Expense:  ${formatMoney(t.expense).padStart(20)}`);
    lines.push(`Net:      ${(t.net >= 0 ? "+" : "−") + formatMoney(Math.abs(t.net)).padStart(19)}`);
    lines.push("```");
    lines.push("");
    if (runway.beforeTracking) {
      lines.push(beforeTrackingLine);
    } else {
      lines.push(`${cashLabel}: *${formatMoney(runway.currentBalance)}*`);
      if (!runway.isHistorical && runway.monthsOfRunway != null && runway.burnRateMonthly > 0) {
        const e = runway.monthsOfRunway < 3 ? "⚠️" : runway.monthsOfRunway < 6 ? "🟡" : "🟢";
        lines.push(`${e} Runway: ~${runway.monthsOfRunway.toFixed(1)} months`);
      }
    }
  }
  if (t.count === 0) lines.push("\n" + s.reportEmpty);
  return { text: lines.join("\n"), inlineKeyboard: navKb };
}

// Used by the LLM-driven `report` intent: maps a free-form "scope" to a picker
// key, then to the (navKey, refDate) the renderer needs. If the LLM populated
// `specific_date`, that overrides scope and renders that exact day.
async function doReport(intent: {
  scope: "today" | "this_week" | "last_week" | "this_month" | "last_month" | "ytd";
  category_key?: string | null;
  specific_date?: string | null;
  language: Lang;
}): Promise<BotReply> {
  if (intent.specific_date && /^\d{4}-\d{2}-\d{2}$/.test(intent.specific_date)) {
    return renderReport({
      navKey: "day",
      refDate: intent.specific_date,
      language: intent.language,
      categoryKey: intent.category_key ?? null,
    });
  }
  const picker: ReportPeriodKey = intent.scope as ReportPeriodKey;
  const { navKey, refDate } = pickerToNav(picker);
  return renderReport({ navKey, refDate, language: intent.language, categoryKey: intent.category_key ?? null });
}

async function doEditLast(intent: { patch: { amount?: number; category_key?: string; note?: string; occurred_on?: string }; language: Lang }, chatId: number): Promise<BotReply> {
  const state = await getChatState(chatId);
  if (!state?.last_transaction_id) {
    return { text: strings(intent.language).noLast };
  }
  const tx = await getTransaction(state.last_transaction_id);
  if (!tx) {
    return { text: strings(intent.language).noLast };
  }

  let category_id = tx.category_id;
  if (intent.patch.category_key) {
    const c = await getCategoryByKey(intent.patch.category_key);
    if (c && c.kind === tx.kind) category_id = c.id;
  }
  const updated = await updateTransaction(tx.id, {
    amount: intent.patch.amount ?? tx.amount,
    category_id,
    note: intent.patch.note ?? tx.note,
    occurred_on: intent.patch.occurred_on ?? tx.occurred_on,
  });
  try { revalidatePath("/"); revalidatePath("/transactions"); revalidatePath("/analytics"); } catch {}
  publish("transaction:updated", { source: "telegram", payload: { id: tx.id } });
  return { text: editConfirm(intent.language, updated.kind, updated.amount, updated.category_label_en, updated.occurred_on) };
}

async function doChangeLanguage(target: Lang, telegram_id: number): Promise<BotReply> {
  await setUserLanguage(telegram_id, target);
  // Reply in the *new* language so the user sees confirmation in what they asked for.
  const txt =
    target === "uz" ? "✅ Til o'zbekchaga o'zgartirildi.\n\nDavom etish uchun pastdagi tugmalarni bosing yoki ovoz yuboring."
    : target === "ru" ? "✅ Язык изменён на русский.\n\nНажимайте кнопки внизу или отправляйте голосовые сообщения."
    : "✅ Language set to English.\n\nTap the buttons below or send a voice message to continue.";
  return { text: txt };
}

async function doListRecent(lang: Lang): Promise<BotReply> {
  const txs = await listTransactions({ limit: 5 });
  if (txs.length === 0) {
    const empty =
      lang === "uz" ? "📋 *So'nggi yozuvlar*\n\nHozircha yozuv yo'q. ➕ Qo'shish tugmasini bosing!"
      : lang === "ru" ? "📋 *Последние записи*\n\nПока ничего нет. Нажмите ➕ Добавить!"
      : "📋 *Recent transactions*\n\nNothing yet. Tap ➕ Add to log your first one!";
    return { text: empty };
  }
  const localized = (c: typeof txs[number]) =>
    lang === "uz" ? c.category_label_uz
    : lang === "ru" ? c.category_label_ru
    : c.category_label_en;
  const header =
    lang === "uz" ? "📋 *So'nggi 5 yozuv* — o'chirish uchun raqamni bosing"
    : lang === "ru" ? "📋 *Последние 5 записей* — нажмите номер для удаления"
    : "📋 *Last 5 transactions* — tap a number to delete";
  const lines = [header, ""];
  txs.forEach((t, i) => {
    const sign = t.kind === "income" ? "+" : "−";
    const icon = t.kind === "income" ? "💰" : "💸";
    const date = format(parseISO(t.occurred_on), "d MMM");
    const note = t.note ? ` _(${t.note})_` : "";
    lines.push(`*${i + 1}.* ${icon} ${sign}${formatMoney(t.amount)} · ${localized(t)} · ${date}${note}`);
  });
  return {
    text: lines.join("\n"),
    inlineKeyboard: recentDeleteButtonsInline(txs.map((t) => t.id)),
  };
}

async function doListCategories(lang: Lang): Promise<BotReply> {
  const cats = await listCategories({ includeArchived: false });
  const income = cats.filter((c) => c.kind === "income");
  const expense = cats.filter((c) => c.kind === "expense");
  const labelOf = (c: typeof cats[number]) =>
    lang === "uz" ? c.label_uz : lang === "ru" ? c.label_ru : c.label_en;

  const headers =
    lang === "uz" ? { title: "📋 *Kategoriyalar*", inc: "*Kirim:*", exp: "*Chiqim:*", hint: "_Yangi qo'shish: \"yangi kategoriya: nom (chiqim)\"_" }
    : lang === "ru" ? { title: "📋 *Категории*",     inc: "*Доходы:*", exp: "*Расходы:*", hint: "_Добавить новую: «создай категорию: название (расход)»_" }
    : { title: "📋 *Categories*", inc: "*Income:*", exp: "*Expenses:*", hint: "_Add a new one: \"create category: name (expense)\"_" };

  const lines = [headers.title, "", headers.inc];
  for (const c of income) lines.push(`• ${labelOf(c)}`);
  lines.push("", headers.exp);
  for (const c of expense) lines.push(`• ${labelOf(c)}`);
  lines.push("", headers.hint);
  return { text: lines.join("\n") };
}

async function doCreateCategory(intent: {
  type?: "create_category";
  label_en: string;
  label_uz: string;
  label_ru: string;
  kind: "income" | "expense" | null;
  language: Lang;
  confirmation: string;
  followup_question: string | null;
}, chatId: number): Promise<BotReply> {
  // Need to know income vs expense before saving. Persist the partial intent
  // so the next user message can complete it (multi-turn flow).
  if (!intent.kind) {
    setPendingIntent(chatId, {
      type: "create_category",
      label_en: intent.label_en,
      label_uz: intent.label_uz,
      label_ru: intent.label_ru,
      language: intent.language,
    });
    return { text: intent.followup_question ?? askKind(intent.language, intent.label_en) };
  }

  const key = await generateUniqueCategoryKey(intent.label_en);
  await createCategory({
    key,
    kind: intent.kind,
    label_en: intent.label_en,
    label_uz: intent.label_uz,
    label_ru: intent.label_ru,
  });
  try { revalidatePath("/categories"); revalidatePath("/transactions"); revalidatePath("/"); } catch {}
  publish("category:changed", { source: "telegram" });

  const text = intent.confirmation?.trim()
    ? intent.confirmation
    : synthesizeCreateCategoryConfirmation(intent.language, intent.label_en, intent.kind);
  return { text };
}

// Recognize a single-word income/expense reply across uz/ru/en — used by the
// multi-turn flow to complete a pending create_category intent.
function parseKindFromText(text: string): "income" | "expense" | null {
  const t = text.toLowerCase().trim();
  if (/^(income|kirim|доход|приход)$/i.test(t)) return "income";
  if (/^(expense|chiqim|xarajat|расход|траты)$/i.test(t)) return "expense";
  // Allow embedded matches too (e.g. "it's an expense")
  if (/\b(income|kirim|доход|приход)\b/i.test(t)) return "income";
  if (/\b(expense|chiqim|xarajat|расход|траты)\b/i.test(t)) return "expense";
  return null;
}

function invalidDateMessage(lang: Lang): string {
  if (lang === "uz") return "❌ Sana noto'g'ri. YYYY-MM-DD shaklida yozing (masalan, 2026-04-15).";
  if (lang === "ru") return "❌ Неверная дата. Используйте формат ГГГГ-ММ-ДД (например, 2026-04-15).";
  return "❌ That date doesn't look right. Use YYYY-MM-DD (e.g., 2026-04-15).";
}

function rateLimitedMessage(lang: Lang): string {
  if (lang === "uz") return "⏳ Hozir biroz band — bir necha soniyadan so'ng qaytadan urinib ko'ring.";
  if (lang === "ru") return "⏳ Сейчас немного занят — попробуйте через несколько секунд.";
  return "⏳ I'm a bit busy right now — please try again in a few seconds.";
}

function askForAmount(lang: Lang, kind: "income" | "expense"): string {
  if (lang === "uz") {
    return kind === "income"
      ? "Qancha kirim bo'ldi? Summani aniq yozing."
      : "Qancha sarfladingiz? Summani aniq yozing.";
  }
  if (lang === "ru") {
    return kind === "income"
      ? "Сколько поступило? Напишите точную сумму."
      : "Сколько потратили? Напишите точную сумму.";
  }
  return kind === "income"
    ? "How much came in? Please send the exact amount."
    : "How much did you spend? Please send the exact amount.";
}

async function doDeleteCategory(intent: {
  category_key: string | null;
  language: Lang;
  confirmation: string;
  followup_question: string | null;
}): Promise<BotReply> {
  if (!intent.category_key) {
    return {
      text: intent.followup_question ?? askWhichCategory(intent.language),
    };
  }
  const cat = await getCategoryByKey(intent.category_key);
  if (!cat) {
    return { text: categoryNotFound(intent.language, intent.category_key) };
  }
  await deleteCategory(cat.id);
  try { revalidatePath("/categories"); revalidatePath("/transactions"); revalidatePath("/"); } catch {}
  publish("category:changed", { source: "telegram" });
  const text = intent.confirmation?.trim()
    ? intent.confirmation
    : synthesizeDeleteCategoryConfirmation(intent.language, cat.label_en);
  return { text };
}

function askWhichCategory(lang: Lang): string {
  if (lang === "uz") return "Qaysi kategoriyani o'chirmoqchisiz? Aniq nom yozing.";
  if (lang === "ru") return "Какую категорию удалить? Напишите точное название.";
  return "Which category do you want to delete? Send the exact name.";
}

function categoryNotFound(lang: Lang, name: string): string {
  if (lang === "uz") return `"${name}" nomli kategoriya topilmadi. Mavjud kategoriyalarni ko'rish uchun /categories yuboring.`;
  if (lang === "ru") return `Категория «${name}» не найдена. Список доступных — /categories.`;
  return `I couldn't find a category called "${name}". Send /categories to see what's available.`;
}

function synthesizeDeleteCategoryConfirmation(lang: Lang, name: string): string {
  if (lang === "uz") return `Kategoriya o'chirildi: *${name}*.`;
  if (lang === "ru") return `Категория удалена: *${name}*.`;
  return `Removed category: *${name}*.`;
}

function askKind(lang: Lang, name: string): string {
  if (lang === "uz") return `"${name}" — kirim kategoriyasimi yoki chiqim?`;
  if (lang === "ru") return `«${name}» — это категория дохода или расхода?`;
  return `Is "${name}" an income category or an expense category?`;
}

async function doDeleteLast(intent: { language: Lang }, chatId: number): Promise<BotReply> {
  const state = await getChatState(chatId);
  if (!state?.last_transaction_id) {
    return { text: strings(intent.language).noLast };
  }
  const tx = await getTransaction(state.last_transaction_id);
  if (!tx) {
    return { text: strings(intent.language).noLast };
  }
  await deleteTransaction(tx.id);
  await setLastTransaction(chatId, null);
  try { revalidatePath("/"); revalidatePath("/transactions"); revalidatePath("/analytics"); } catch {}
  publish("transaction:deleted", { source: "telegram", payload: { id: tx.id } });
  return {
    text: strings(intent.language).deleted(tx.category_label_en, formatMoney(tx.amount)),
  };
}

// Public so the callback_query handler can call it directly when the user taps
// the 🗑 Delete button under a saved transaction.
export async function deleteByTxId(txId: number, chatId: number, language: Lang): Promise<BotReply> {
  const tx = await getTransaction(txId);
  if (!tx) return { text: strings(language).noLast };
  await deleteTransaction(txId);
  // If this was the most-recent tx for this chat, clear the pointer too.
  const state = await getChatState(chatId);
  if (state?.last_transaction_id === txId) await setLastTransaction(chatId, null);
  try { revalidatePath("/"); revalidatePath("/transactions"); revalidatePath("/analytics"); } catch {}
  publish("transaction:deleted", { source: "telegram", payload: { id: txId } });
  return { text: strings(language).deleted(tx.category_label_en, formatMoney(tx.amount)) };
}

function synthesizeLogConfirmation(
  lang: Lang,
  kind: "income" | "expense",
  amount: number,
  catLabel: string,
  isoDate: string,
): string {
  const date = format(parseISO(isoDate), "d MMM yyyy");
  const money = formatMoney(amount);
  if (lang === "uz") {
    const verb = kind === "income" ? "kirim" : "chiqim";
    return `Saqladim: ${money} ${verb} — ${catLabel}, ${date}.`;
  }
  if (lang === "ru") {
    const verb = kind === "income" ? "доход" : "расход";
    return `Сохранил: ${money} ${verb} — ${catLabel}, ${date}.`;
  }
  const verb = kind === "income" ? "income" : "expense";
  return `Saved: ${money} ${verb} — ${catLabel}, ${date}.`;
}

function synthesizeCreateCategoryConfirmation(
  lang: Lang,
  name: string,
  kind: "income" | "expense",
): string {
  const kindWord =
    lang === "uz" ? (kind === "income" ? "kirim" : "chiqim")
    : lang === "ru" ? (kind === "income" ? "доход" : "расход")
    : kind;
  if (lang === "uz") return `Yangi kategoriya yaratildi: *${name}* (${kindWord}).`;
  if (lang === "ru") return `Создана новая категория: *${name}* (${kindWord}).`;
  return `Created new category: *${name}* (${kindWord}).`;
}

function nudgeAboutCategory(lang: Lang): string {
  if (lang === "uz") return "_Kategoriya aniq emas — agar boshqa kategoriya bo'lsa, \"o'zgartir, kategoriya: ...\" deb yozing._";
  if (lang === "ru") return "_Категорию выбрал на глаз — если не та, напишите «исправь, категория: …»._";
  return "_I picked a category on my best guess — if it's wrong, say \"fix it, category: …\"._";
}

function editConfirm(lang: Lang, kind: "income" | "expense", amount: number, cat: string, when: string): string {
  const date = format(parseISO(when), "d MMM yyyy");
  if (lang === "uz") return `Yangilandi: ${kind === "income" ? "kirim" : "chiqim"} ${formatMoney(amount)} (${cat}, ${date}).`;
  if (lang === "ru") return `Обновлено: ${kind === "income" ? "доход" : "расход"} ${formatMoney(amount)} (${cat}, ${date}).`;
  return `Updated: ${kind} ${formatMoney(amount)} (${cat}, ${date}).`;
}
