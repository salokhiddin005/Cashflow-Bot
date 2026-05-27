import { Bot, type Context, InlineKeyboard, Keyboard } from "grammy";
import {
  deleteByTxId,
  doReportPicker,
  handleIncoming,
  navStep,
  pickerToNav,
  renderReport,
  type BotReply,
  type InlineButton,
} from "./handler";
import { setPendingIntent } from "./state";
import { mapTelegramLang, strings, welcomeMessage } from "./welcome";
import { confirmDeleteTxInline, mainMenuLayout } from "./keyboards";
import { getTransaction } from "../db/queries";
import { format, parseISO } from "date-fns";
import { formatMoney } from "../format";
import { handleWizardCallback, isWizardState } from "./wizard";
import { getUserLanguage, setUserLanguage } from "../db/queries";
import { ensureBotContext } from "./per-user";
import { getChatState } from "./state";
import type { Lang } from "../db/types";

let _bot: Bot | null = null;

export function getBot(): Bot {
  if (_bot) return _bot;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");
  const bot = new Bot(token);
  registerHandlers(bot);
  _bot = bot;
  return bot;
}

function registerHandlers(bot: Bot) {
  bot.command("start",      async (ctx) => { await runMessage(ctx); });
  bot.command("help",       async (ctx) => { await runMessage(ctx); });
  bot.command("report",     async (ctx) => { await runMessage(ctx); });
  bot.command("undo",       async (ctx) => { await runMessage(ctx); });
  bot.command("cancel",     async (ctx) => { await runMessage(ctx); });
  bot.command("lang",       async (ctx) => { await runMessage(ctx); });
  bot.command("categories", async (ctx) => { await runMessage(ctx); });
  bot.command("add",        async (ctx) => { await runMessage(ctx); });
  bot.command("dashboard",  async (ctx) => { await runMessage(ctx); });
  bot.command("reset",      async (ctx) => { await runMessage(ctx); });
  bot.on(":voice",          async (ctx) => { await runMessage(ctx); });
  bot.on(":audio",          async (ctx) => { await runMessage(ctx); });
  bot.on("message:text",    async (ctx) => { await runMessage(ctx); });
  bot.on("callback_query:data", async (ctx) => { await runCallback(ctx); });
  bot.catch((err) => {
    console.error("bot error", err);
  });
}

async function runMessage(ctx: Context) {
  const chat = ctx.chat;
  const from = ctx.from;
  if (!chat || !from) return;
  await ctx.replyWithChatAction("typing").catch(() => {});

  const baseUser = {
    telegram_id: from.id,
    username: from.username,
    first_name: from.first_name,
    last_name: from.last_name,
    language_code: from.language_code,
  };

  let voiceBuf: Buffer | undefined;
  if (ctx.message?.voice) {
    const file = await ctx.api.getFile(ctx.message.voice.file_id);
    voiceBuf = await downloadTelegramFile(file.file_path!);
  } else if (ctx.message?.audio) {
    const file = await ctx.api.getFile(ctx.message.audio.file_id);
    voiceBuf = await downloadTelegramFile(file.file_path!);
  }

  try {
    const reply = await handleIncoming({
      chat_id: chat.id,
      user: baseUser,
      text: ctx.message?.text ?? ctx.message?.caption ?? undefined,
      voice: voiceBuf ? { buffer: voiceBuf } : undefined,
    });
    const lang = ((await getUserLanguage(from.id)) ?? mapTelegramLang(from.language_code)) as Lang;
    await sendReply(ctx, reply, lang);
  } catch (e) {
    console.error("handleIncoming threw", e);
    await ctx.reply("Sorry — something broke on my end. Try again in a moment.");
  }
}

async function runCallback(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  const chatId = ctx.chat?.id;
  const fromId = ctx.from?.id;
  const userLang =
    (fromId ? await getUserLanguage(fromId) : null) ?? mapTelegramLang(ctx.from?.language_code);
  if (!data || !chatId || !fromId) {
    await ctx.answerCallbackQuery().catch(() => {});
    return;
  }

  // Language picker: `lang:uz` | `lang:ru` | `lang:en`
  const lm = data.match(/^lang:(uz|ru|en)$/);
  if (lm) {
    const lang = lm[1] as Lang;
    await setUserLanguage(fromId, lang);
    try {
      await ctx.editMessageText(welcomeMessage(lang), {
        parse_mode: "Markdown",
        link_preview_options: { is_disabled: true },
      });
    } catch {
      await ctx.reply(welcomeMessage(lang), {
        parse_mode: "Markdown",
        link_preview_options: { is_disabled: true },
      });
    }
    await ctx.reply("👇", { reply_markup: mainMenuKeyboard(lang) }).catch(() => {});
    await ctx.answerCallbackQuery({ text: strings(lang).langChanged }).catch(() => {});
    return;
  }

  // Wizard taps: wiz:* — run through the state machine
  if (data.startsWith("wiz:")) {
    const state = await getChatState(chatId);
    let parsed: unknown = null;
    try { parsed = state?.pending_intent ? JSON.parse(state.pending_intent) : null; } catch {}
    const wizState = isWizardState(parsed) ? parsed : null;
    // Make sure the user has a workspace before any wizard action runs.
    const { tgUser, workspace } = await ensureBotContext({
      telegram_id: fromId,
      username: ctx.from?.username,
      first_name: ctx.from?.first_name,
      last_name: ctx.from?.last_name,
      language_code: userLang,
    });
    const reply = await handleWizardCallback(chatId, data, wizState, workspace.id, tgUser.id);
    try {
      await ctx.editMessageText(reply.text, {
        parse_mode: "Markdown",
        reply_markup: reply.inlineKeyboard ? buildInlineKeyboard(reply.inlineKeyboard) : undefined,
      });
    } catch {
      await ctx.reply(reply.text, {
        parse_mode: "Markdown",
        reply_markup: reply.inlineKeyboard ? buildInlineKeyboard(reply.inlineKeyboard) : undefined,
      });
    }
    await ctx.answerCallbackQuery().catch(() => {});
    return;
  }

  // Inline delete (immediate, no confirm): `del:<txId>`
  const m = data.match(/^del:(\d+)$/);
  if (m) {
    const txId = Number(m[1]);
    const { workspace } = await ensureBotContext({
      telegram_id: fromId,
      username: ctx.from?.username,
      first_name: ctx.from?.first_name,
      last_name: ctx.from?.last_name,
      language_code: userLang,
    });
    const reply = await deleteByTxId(workspace.id, txId, chatId, userLang);
    try {
      const original = ctx.callbackQuery!.message?.text ?? "";
      const edited = original ? `~${original}~` : reply.text;
      await ctx.editMessageText(`${edited}\n\n✅ ${reply.text}`, { parse_mode: "Markdown" });
    } catch {
      await ctx.reply(reply.text);
    }
    await ctx.answerCallbackQuery({ text: strings(userLang).saved }).catch(() => {});
    return;
  }

  // 🗑 from the Recent list: `delc:<txId>` → show a confirmation step.
  const dcm = data.match(/^delc:(\d+)$/);
  if (dcm) {
    const txId = Number(dcm[1]);
    const { workspace } = await ensureBotContext({
      telegram_id: fromId,
      username: ctx.from?.username,
      first_name: ctx.from?.first_name,
      last_name: ctx.from?.last_name,
      language_code: userLang,
    });
    const tx = await getTransaction(workspace.id, txId);
    if (!tx) {
      await ctx.answerCallbackQuery({ text: strings(userLang).noLast }).catch(() => {});
      return;
    }
    const sign = tx.kind === "income" ? "+" : "−";
    const icon = tx.kind === "income" ? "💰" : "💸";
    const date = format(parseISO(tx.occurred_on), "d MMM yyyy");
    const catLabel =
      userLang === "uz" ? tx.category_label_uz
      : userLang === "ru" ? tx.category_label_ru
      : tx.category_label_en;
    const note = tx.note ? `\n_${tx.note}_` : "";
    const heading =
      userLang === "uz" ? "*O'chirilsinmi?*"
      : userLang === "ru" ? "*Удалить?*"
      : "*Delete this?*";
    const body = `${heading}\n\n${icon} ${sign}${formatMoney(tx.amount)} · ${catLabel} · ${date}${note}`;
    try {
      await ctx.editMessageText(body, {
        parse_mode: "Markdown",
        reply_markup: buildInlineKeyboard(confirmDeleteTxInline(txId, userLang)),
      });
    } catch {
      await ctx.reply(body, {
        parse_mode: "Markdown",
        reply_markup: buildInlineKeyboard(confirmDeleteTxInline(txId, userLang)),
      });
    }
    await ctx.answerCallbackQuery().catch(() => {});
    return;
  }

  // Confirm-delete step: `delconf:<txId>` → actually delete.
  const dcf = data.match(/^delconf:(\d+)$/);
  if (dcf) {
    const txId = Number(dcf[1]);
    const { workspace } = await ensureBotContext({
      telegram_id: fromId,
      username: ctx.from?.username,
      first_name: ctx.from?.first_name,
      last_name: ctx.from?.last_name,
      language_code: userLang,
    });
    const reply = await deleteByTxId(workspace.id, txId, chatId, userLang);
    try {
      await ctx.editMessageText(`✅ ${reply.text}`, { parse_mode: "Markdown" });
    } catch {
      await ctx.reply(reply.text);
    }
    await ctx.answerCallbackQuery({ text: strings(userLang).saved }).catch(() => {});
    return;
  }

  // ── Report picker / navigation ──────────────────────────────────────
  if (data === "rep:menu") {
    const reply = doReportPicker(userLang);
    try {
      await ctx.editMessageText(reply.text, {
        parse_mode: "Markdown",
        reply_markup: reply.inlineKeyboard ? buildInlineKeyboard(reply.inlineKeyboard) : undefined,
      });
    } catch {
      await ctx.reply(reply.text, {
        parse_mode: "Markdown",
        reply_markup: reply.inlineKeyboard ? buildInlineKeyboard(reply.inlineKeyboard) : undefined,
      });
    }
    await ctx.answerCallbackQuery().catch(() => {});
    return;
  }
  if (data === "rep:custom") {
    await setPendingIntent(chatId, { type: "report_date_input" });
    const prompt =
      userLang === "uz" ? "✏️ Qaysi sana? YYYY-MM-DD shaklida yozing (masalan, 2026-04-15)."
      : userLang === "ru" ? "✏️ Какая дата? Напишите в формате ГГГГ-ММ-ДД (например, 2026-04-15)."
      : "✏️ Which date? Type it as YYYY-MM-DD (e.g., 2026-04-15).";
    try { await ctx.editMessageText(prompt); } catch { await ctx.reply(prompt); }
    await ctx.answerCallbackQuery().catch(() => {});
    return;
  }
  const repNav = data.match(/^rep:nav:(prev|next):(day|week|month|ytd):(\d{4}-\d{2}-\d{2})$/);
  if (repNav) {
    const dir = repNav[1] as "prev" | "next";
    const navKey = repNav[2] as "day" | "week" | "month" | "ytd";
    const refDate = repNav[3];
    const newRef = navStep(navKey, refDate, dir);
    const { workspace } = await ensureBotContext({
      telegram_id: fromId,
      username: ctx.from?.username,
      first_name: ctx.from?.first_name,
      last_name: ctx.from?.last_name,
      language_code: userLang,
    });
    const reply = await renderReport({ workspaceId: workspace.id, navKey, refDate: newRef, language: userLang });
    try {
      await ctx.editMessageText(reply.text, {
        parse_mode: "Markdown",
        reply_markup: reply.inlineKeyboard ? buildInlineKeyboard(reply.inlineKeyboard) : undefined,
      });
    } catch {
      await ctx.reply(reply.text, {
        parse_mode: "Markdown",
        reply_markup: reply.inlineKeyboard ? buildInlineKeyboard(reply.inlineKeyboard) : undefined,
      });
    }
    await ctx.answerCallbackQuery().catch(() => {});
    return;
  }
  const repPick = data.match(/^rep:(today|yesterday|this_week|last_week|this_month|last_month|ytd)$/);
  if (repPick) {
    const { navKey, refDate } = pickerToNav(repPick[1] as Parameters<typeof pickerToNav>[0]);
    const { workspace } = await ensureBotContext({
      telegram_id: fromId,
      username: ctx.from?.username,
      first_name: ctx.from?.first_name,
      last_name: ctx.from?.last_name,
      language_code: userLang,
    });
    const reply = await renderReport({ workspaceId: workspace.id, navKey, refDate, language: userLang });
    try {
      await ctx.editMessageText(reply.text, {
        parse_mode: "Markdown",
        reply_markup: reply.inlineKeyboard ? buildInlineKeyboard(reply.inlineKeyboard) : undefined,
      });
    } catch {
      await ctx.reply(reply.text, {
        parse_mode: "Markdown",
        reply_markup: reply.inlineKeyboard ? buildInlineKeyboard(reply.inlineKeyboard) : undefined,
      });
    }
    await ctx.answerCallbackQuery().catch(() => {});
    return;
  }

  // Cancel a pending delete.
  if (data === "delcancel") {
    const cancelText =
      userLang === "uz" ? "Bekor qilindi."
      : userLang === "ru" ? "Отменено."
      : "Cancelled.";
    try {
      await ctx.editMessageText(cancelText);
    } catch { /* ignore */ }
    await ctx.answerCallbackQuery().catch(() => {});
    return;
  }

  await ctx.answerCallbackQuery().catch(() => {});
}

async function sendReply(ctx: Context, reply: BotReply, lang: Lang) {
  const inline = reply.inlineKeyboard ? buildInlineKeyboard(reply.inlineKeyboard) : undefined;
  const reply_markup = inline ?? mainMenuKeyboard(lang);
  try {
    await ctx.reply(reply.text, { parse_mode: "Markdown", reply_markup });
  } catch {
    await ctx.reply(reply.text, { reply_markup });
  }
}

function buildInlineKeyboard(rows: InlineButton[][]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const row of rows) {
    for (const btn of row) {
      if (btn.url) kb.url(btn.text, btn.url);
      else if (btn.callbackData) kb.text(btn.text, btn.callbackData);
    }
    kb.row();
  }
  return kb;
}

function mainMenuKeyboard(lang: Lang): Keyboard {
  const kb = new Keyboard().persistent().resized();
  for (const row of mainMenuLayout(lang)) {
    for (const label of row) kb.text(label);
    kb.row();
  }
  return kb;
}

async function downloadTelegramFile(filePath: string): Promise<Buffer> {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const url = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Telegram file download ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
