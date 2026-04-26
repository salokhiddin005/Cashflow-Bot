import { revalidatePath } from "next/cache";
import { format, parseISO } from "date-fns";
import {
  amountPickerInline,
  categoryPickerInline,
  confirmSaveInline,
  datePickerInline,
  kindPickerInline,
  noteSkipInline,
  wizardPrompts,
} from "./keyboards";
import { setLastTransaction, setPendingIntent } from "./state";
import {
  createTransaction,
  getCategoryById,
  listCategories,
} from "../db/queries";
import { formatMoney } from "../format";
import type { BotReply } from "./handler";
import type { Lang } from "../db/types";

export type WizardStep =
  | "kind"
  | "amount"
  | "amount_typing"
  | "category"
  | "date"
  | "date_typing"
  | "note"
  | "confirm";

export type WizardState = {
  type: "log_wizard";
  step: WizardStep;
  language: Lang;
  draft: {
    kind?: "income" | "expense";
    amount?: number;
    category_id?: number;
    occurred_on?: string; // YYYY-MM-DD
    note?: string;
  };
};

const todayISO = () => format(new Date(), "yyyy-MM-dd");
const yesterdayISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return format(d, "yyyy-MM-dd");
};

export function isWizardState(p: unknown): p is WizardState {
  return !!p && typeof p === "object" && (p as { type?: string }).type === "log_wizard";
}

// ────────────────────────────────────────────────────────────────────
// Entry points
// ────────────────────────────────────────────────────────────────────

export async function startLogWizard(chatId: number, lang: Lang): Promise<BotReply> {
  const state: WizardState = {
    type: "log_wizard",
    step: "kind",
    language: lang,
    draft: {},
  };
  await setPendingIntent(chatId, state);
  return {
    text: wizardPrompts(lang).chooseKind,
    inlineKeyboard: kindPickerInline(lang),
  };
}

export async function cancelWizard(chatId: number, lang: Lang): Promise<BotReply> {
  await setPendingIntent(chatId, null);
  return { text: wizardPrompts(lang).cancelled };
}

// ────────────────────────────────────────────────────────────────────
// Callback router (wiz:* taps from inline keyboards)
// ────────────────────────────────────────────────────────────────────

export async function handleWizardCallback(
  chatId: number,
  callbackData: string,
  state: WizardState | null,
  telegramUserId: number,
): Promise<BotReply> {
  // Cancel anywhere ends the wizard.
  if (callbackData === "wiz:cancel") {
    return cancelWizard(chatId, state?.language ?? "en");
  }
  if (!state) {
    // Stale tap on a wizard button — gently restart from kind picker.
    return startLogWizard(chatId, "en");
  }
  const lang = state.language;

  // Step: choose kind
  const km = callbackData.match(/^wiz:kind:(income|expense)$/);
  if (km) {
    state.draft.kind = km[1] as "income" | "expense";
    state.step = "amount";
    await setPendingIntent(chatId, state);
    return {
      text: wizardPrompts(lang).chooseAmount,
      inlineKeyboard: amountPickerInline(lang),
    };
  }

  // Step: choose amount
  if (callbackData === "wiz:amt:custom") {
    state.step = "amount_typing";
    await setPendingIntent(chatId, state);
    return { text: wizardPrompts(lang).typeAmount };
  }
  const am = callbackData.match(/^wiz:amt:(\d+)$/);
  if (am) {
    state.draft.amount = parseInt(am[1], 10);
    state.step = "category";
    await setPendingIntent(chatId, state);
    return categoryStep(state);
  }

  // Step: choose category
  const cm = callbackData.match(/^wiz:cat:(\d+)$/);
  if (cm) {
    state.draft.category_id = parseInt(cm[1], 10);
    state.step = "date";
    await setPendingIntent(chatId, state);
    return {
      text: wizardPrompts(lang).chooseDate,
      inlineKeyboard: datePickerInline(lang),
    };
  }

  // Step: choose date
  if (callbackData === "wiz:date:today") {
    state.draft.occurred_on = todayISO();
    state.step = "note";
    await setPendingIntent(chatId, state);
    return {
      text: wizardPrompts(lang).addNote,
      inlineKeyboard: noteSkipInline(lang),
    };
  }
  if (callbackData === "wiz:date:yesterday") {
    state.draft.occurred_on = yesterdayISO();
    state.step = "note";
    await setPendingIntent(chatId, state);
    return {
      text: wizardPrompts(lang).addNote,
      inlineKeyboard: noteSkipInline(lang),
    };
  }
  if (callbackData === "wiz:date:custom") {
    state.step = "date_typing";
    await setPendingIntent(chatId, state);
    return { text: wizardPrompts(lang).typeDate };
  }

  // Step: skip note
  if (callbackData === "wiz:note:skip") {
    state.step = "confirm";
    await setPendingIntent(chatId, state);
    return confirmStep(state);
  }

  // Step: save (final)
  if (callbackData === "wiz:save") {
    return finalizeWizard(chatId, state, telegramUserId);
  }

  // Unknown callback — bail out.
  return cancelWizard(chatId, lang);
}

// ────────────────────────────────────────────────────────────────────
// Text router (when wizard is waiting for typed input)
// ────────────────────────────────────────────────────────────────────

export async function handleWizardText(
  chatId: number,
  text: string,
  state: WizardState,
  telegramUserId: number,
): Promise<BotReply> {
  // telegramUserId reserved for future per-user wizard logic
  void telegramUserId;
  const lang = state.language;
  const trimmed = text.trim();

  if (state.step === "amount_typing") {
    const amount = parseAmount(trimmed);
    if (amount == null || amount <= 0) {
      return { text: wizardPrompts(lang).invalidAmount };
    }
    state.draft.amount = amount;
    state.step = "category";
    await setPendingIntent(chatId, state);
    return categoryStep(state);
  }

  if (state.step === "date_typing") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return { text: wizardPrompts(lang).invalidDate };
    }
    state.draft.occurred_on = trimmed;
    state.step = "note";
    await setPendingIntent(chatId, state);
    return {
      text: wizardPrompts(lang).addNote,
      inlineKeyboard: noteSkipInline(lang),
    };
  }

  if (state.step === "note") {
    state.draft.note = trimmed.slice(0, 500);
    state.step = "confirm";
    await setPendingIntent(chatId, state);
    return confirmStep(state);
  }

  // For other steps, the typed input doesn't fit — re-show the current step.
  return reShowStep(state);
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

async function categoryStep(state: WizardState): Promise<BotReply> {
  const cats = await listCategories({ includeArchived: false });
  return {
    text: wizardPrompts(state.language).chooseCategory,
    inlineKeyboard: categoryPickerInline(cats, state.draft.kind!, state.language),
  };
}

async function confirmStep(state: WizardState): Promise<BotReply> {
  const lang = state.language;
  const summary = await formatDraftSummary(state);
  return {
    text: wizardPrompts(lang).confirm(summary),
    inlineKeyboard: confirmSaveInline(lang),
  };
}

async function reShowStep(state: WizardState): Promise<BotReply> {
  const lang = state.language;
  switch (state.step) {
    case "kind":
      return { text: wizardPrompts(lang).chooseKind, inlineKeyboard: kindPickerInline(lang) };
    case "amount":
      return { text: wizardPrompts(lang).chooseAmount, inlineKeyboard: amountPickerInline(lang) };
    case "category":
      return categoryStep(state);
    case "date":
      return { text: wizardPrompts(lang).chooseDate, inlineKeyboard: datePickerInline(lang) };
    case "note":
      return { text: wizardPrompts(lang).addNote, inlineKeyboard: noteSkipInline(lang) };
    case "confirm":
      return confirmStep(state);
    default:
      return cancelWizard(0 as never, lang);
  }
}

async function formatDraftSummary(state: WizardState): Promise<string> {
  const lang = state.language;
  const d = state.draft;
  const cat = d.category_id ? await getCategoryById(d.category_id) : undefined;
  const catLabel = cat
    ? (lang === "uz" ? cat.label_uz : lang === "ru" ? cat.label_ru : cat.label_en)
    : "—";
  const date = d.occurred_on ? format(parseISO(d.occurred_on), "d MMM yyyy") : "—";
  const amount = d.amount != null ? formatMoney(d.amount) : "—";
  const kindIcon = d.kind === "income" ? "💰" : "💸";
  const kindWord =
    lang === "uz" ? (d.kind === "income" ? "kirim" : "chiqim")
    : lang === "ru" ? (d.kind === "income" ? "доход" : "расход")
    : (d.kind === "income" ? "income" : "expense");
  const lines = [
    `${kindIcon} *${amount}* (${kindWord})`,
    `📂 ${catLabel}`,
    `📅 ${date}`,
  ];
  if (d.note) lines.push(`📝 ${d.note}`);
  return lines.join("\n");
}

async function finalizeWizard(chatId: number, state: WizardState, telegramUserId: number): Promise<BotReply> {
  const lang = state.language;
  const d = state.draft;
  if (!d.kind || !d.amount || !d.category_id || !d.occurred_on) {
    // Shouldn't happen, but bail safely.
    return cancelWizard(chatId, lang);
  }
  const tx = await createTransaction({
    kind: d.kind,
    amount: d.amount,
    category_id: d.category_id,
    occurred_on: d.occurred_on,
    note: d.note ?? null,
    source: "telegram",
    telegram_user_id: telegramUserId,
  });
  await setLastTransaction(chatId, tx.id);
  await setPendingIntent(chatId, null);
  try { revalidatePath("/"); revalidatePath("/transactions"); revalidatePath("/analytics"); } catch {}
  return {
    text: wizardPrompts(lang).saved + "\n\n" + (await formatDraftSummary(state)),
    inlineKeyboard: [[{ text: lang === "uz" ? "🗑 O'chirish" : lang === "ru" ? "🗑 Удалить" : "🗑 Delete", callbackData: `del:${tx.id}` }]],
  };
}

// Parse a free-form amount string. Handles "1.2m", "500k", "1 200 000", "1,200,000".
function parseAmount(text: string): number | null {
  const t = text.toLowerCase().replace(/[\s,_]/g, "").trim();
  // Match number + optional suffix
  const m = t.match(/^(\d+(?:\.\d+)?)([kmб]|млн|mln|ming|ming\.|тыс|тыс\.)?$/iu);
  if (!m) {
    const n = Number(t);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  const num = parseFloat(m[1]);
  const suffix = (m[2] ?? "").toLowerCase();
  let mult = 1;
  if (suffix === "k" || suffix === "ming" || suffix === "ming." || suffix === "тыс" || suffix === "тыс.") mult = 1_000;
  else if (suffix === "m" || suffix === "млн" || suffix === "mln" || suffix === "б") mult = 1_000_000;
  return Number.isFinite(num) ? Math.round(num * mult) : null;
}
