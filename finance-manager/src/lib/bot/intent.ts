import { z } from "zod";
import { format } from "date-fns";
import type { Category, Lang } from "../db/types";
import { generateJson } from "./llm";

export type LogIntent = {
  type: "log";
  kind: "income" | "expense";
  amount: number | null;            // null when LLM couldn't extract; handler asks
  category_key: string | null;
  category_confidence: "high" | "medium" | "low";
  occurred_on: string;              // YYYY-MM-DD (defaults to today)
  note: string | null;
  language: Lang;
  confirmation: string;
  followup_question: string | null;
};

export type ReportIntent = {
  type: "report";
  scope: "today" | "this_week" | "last_week" | "this_month" | "last_month" | "ytd";
  category_key?: string | null;
  // Optional: if set, the report is for this exact day, overriding `scope`.
  // Lets users say "show me April 15" or "yesterday's report" by date.
  specific_date?: string | null;
  language: Lang;
};

export type EditIntent = {
  type: "edit_last";
  patch: { amount?: number; category_key?: string; note?: string; occurred_on?: string };
  language: Lang;
};

export type DeleteIntent = { type: "delete_last"; language: Lang };

export type DeleteCategoryIntent = {
  type: "delete_category";
  category_key: string | null;       // null when LLM couldn't match — handler asks
  language: Lang;
  confirmation: string;
  followup_question: string | null;
};

// Voice-friendly intents — let users open menus / browse without tapping.

export type ShowPickerIntent = {
  type: "show_picker";          // "open reports", "show me reports menu"
  language: Lang;
};

export type ShowRecentIntent = {
  type: "show_recent";          // "show recent transactions", "what did I log"
  language: Lang;
};

export type ChangeLanguageIntent = {
  type: "change_language";      // "switch to russian", "change language to uzbek"
  target_language: Lang;
  language: Lang;               // language of the user's *current* request
};

export type SmalltalkIntent = {
  type: "smalltalk";
  reply: string;
  language: Lang;
};

export type CreateCategoryIntent = {
  type: "create_category";
  // Always provide labels in all three languages — the LLM should translate.
  label_en: string;
  label_uz: string;
  label_ru: string;
  // null when the user didn't say. The handler will ask via followup_question.
  kind: "income" | "expense" | null;
  language: Lang;
  confirmation: string;            // shown after creation
  followup_question: string | null; // set when kind is null
};

export type ParsedIntent =
  | LogIntent
  | ReportIntent
  | EditIntent
  | DeleteIntent
  | SmalltalkIntent
  | CreateCategoryIntent
  | DeleteCategoryIntent
  | ShowPickerIntent
  | ShowRecentIntent
  | ChangeLanguageIntent;

const intentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("log"),
    kind: z.enum(["income", "expense"]),
    // amount may be null/missing when the LLM misclassifies an ambiguous
    // message as "log" — handler treats null as "ask for amount".
    amount: z.number().int().positive().nullable().optional().default(null),
    category_key: z.string().nullable().optional().default(null),
    category_confidence: z.enum(["high", "medium", "low"]).optional().default("medium"),
    occurred_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .default(() => new Date().toISOString().slice(0, 10)),
    note: z.string().nullable().optional().default(null),
    language: z.enum(["uz", "ru", "en"]),
    // The LLM sometimes omits these — handler will synthesize a confirmation
    // if empty, and treat null/empty followup_question as "no question".
    confirmation: z.string().optional().default(""),
    followup_question: z.string().nullable().optional().default(null),
  }),
  z.object({
    type: z.literal("report"),
    scope: z.enum(["today", "this_week", "last_week", "this_month", "last_month", "ytd"]),
    category_key: z.string().nullable().optional(),
    specific_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    language: z.enum(["uz", "ru", "en"]),
  }),
  z.object({
    type: z.literal("edit_last"),
    patch: z.object({
      amount: z.number().int().positive().optional(),
      category_key: z.string().optional(),
      note: z.string().optional(),
      occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }),
    language: z.enum(["uz", "ru", "en"]),
  }),
  z.object({
    type: z.literal("delete_last"),
    language: z.enum(["uz", "ru", "en"]),
  }),
  z.object({
    type: z.literal("smalltalk"),
    reply: z.string(),
    language: z.enum(["uz", "ru", "en"]),
  }),
  z.object({
    type: z.literal("create_category"),
    label_en: z.string().min(1).max(40),
    label_uz: z.string().min(1).max(40),
    label_ru: z.string().min(1).max(40),
    // LLM may return "unknown"/"" instead of null when undecided; coerce.
    kind: z
      .union([z.enum(["income", "expense"]), z.null(), z.literal(""), z.string()])
      .optional()
      .transform((v) => (v === "income" || v === "expense" ? v : null)),
    language: z.enum(["uz", "ru", "en"]),
    confirmation: z.string().optional().default(""),
    followup_question: z.string().nullable().optional().default(null),
  }),
  z.object({
    type: z.literal("delete_category"),
    category_key: z.string().nullable().optional().default(null),
    language: z.enum(["uz", "ru", "en"]),
    confirmation: z.string().optional().default(""),
    followup_question: z.string().nullable().optional().default(null),
  }),
  z.object({
    type: z.literal("show_picker"),
    language: z.enum(["uz", "ru", "en"]),
  }),
  z.object({
    type: z.literal("show_recent"),
    language: z.enum(["uz", "ru", "en"]),
  }),
  z.object({
    type: z.literal("change_language"),
    target_language: z.enum(["uz", "ru", "en"]),
    language: z.enum(["uz", "ru", "en"]),
  }),
]);

// JSON Schema (Gemini-compatible subset) — must mirror the Zod above.
// Gemini's structured output requires a single-shape schema; we list every
// possible field as optional since `type` discriminates them.
const responseSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["log", "report", "edit_last", "delete_last", "smalltalk", "create_category", "delete_category", "show_picker", "show_recent", "change_language"] },
    language: { type: "string", enum: ["uz", "ru", "en"] },
    // log-only
    kind: { type: "string", enum: ["income", "expense"], nullable: true },
    amount: { type: "integer", minimum: 1 },
    category_key: { type: "string", nullable: true },
    category_confidence: { type: "string", enum: ["high", "medium", "low"] },
    occurred_on: { type: "string", description: "ISO date YYYY-MM-DD" },
    note: { type: "string", nullable: true },
    confirmation: { type: "string" },
    followup_question: { type: "string", nullable: true },
    // report-only
    scope: { type: "string", enum: ["today", "this_week", "last_week", "this_month", "last_month", "ytd"] },
    // edit-only
    patch: {
      type: "object",
      properties: {
        amount: { type: "integer", minimum: 1 },
        category_key: { type: "string" },
        note: { type: "string" },
        occurred_on: { type: "string" },
      },
    },
    // smalltalk-only
    reply: { type: "string" },
    // create_category-only
    label_en: { type: "string" },
    label_uz: { type: "string" },
    label_ru: { type: "string" },
    // change_language-only
    target_language: { type: "string", enum: ["uz", "ru", "en"] },
    // report-only (optional ISO date)
    specific_date: { type: "string", nullable: true },
  },
  required: ["type", "language"],
} as const;

const SYSTEM = `You are the natural-language parser for a Telegram bot used by small and medium businesses in Uzbekistan to log income and expenses.

Users will write or speak in **Uzbek (Latin or Cyrillic), Russian, or English**, often mixing them. Detect the language of the latest user message and reply in the SAME language.

Your job: classify the user's message into ONE intent and respond ONLY with a single JSON object that matches the schema. No code fences. No commentary.

Intent types:

"log": user is logging an income or expense.
- amount: integer in UZS. Convert to UZS using common sense if obvious — e.g. "100 dollars" → assume 1 USD ≈ 12500 UZS unless they specify.
- kind: "income" if money came in (sales, payment received). "expense" if it went out.
- category_key: pick from the categories below by their "key". If nothing fits, use null (defaults to "other"). category_confidence reflects certainty.
- occurred_on: today is {{TODAY}} (Asia/Tashkent). "bugun/today/сегодня" → today; "kecha/yesterday/вчера" → yesterday; weekday names → most recent of that day. Default to today if unstated.
- note: any extra context the user mentioned (counterparty, project, item). null if nothing notable.
- confirmation: SHORT natural sentence in user's language confirming what you will save (amount, kind, category, date). Examples:
  • UZ: "Bugun sotuvdan 1 200 000 so'm kirim sifatida saqladim."
  • RU: "Записал расход 350 000 на логистику за вчера."
  • EN: "Saved 4.2M UZS income from sales for today."
- followup_question: ONLY set this (non-null) if you genuinely cannot save without clarification (truly ambiguous amount/kind). Otherwise null. Prefer logging with low confidence over nagging.

"report": user is asking about their data ("how much did we earn this week?", "logistika xarajat oyda qancha?", "what did we spend on rent in March?", "show me April 15 report", "show yesterday's numbers"). scope is the time period. **category_key MUST be set** when the user names a specific category (logistics, rent, sales, etc.) — pick the matching key from the categories list. Set category_key to null when the user wants overall totals. If the user names a SPECIFIC DATE ("April 15", "March 3", "2026-04-10"), set specific_date to that date in YYYY-MM-DD form (assume current year unless user states otherwise) and set scope to "today" — the handler will use specific_date as the day.

"edit_last": user wants to fix the last transaction they logged ("o'zgartir, 1 500 000 edi", "no, that was 200k not 250k"). Provide ONLY the fields they want to change in patch.

"delete_last": user wants to undo their MOST RECENT *transaction* specifically. Examples: "o'chir", "delete that", "удали", "delete last entry", "/undo", "cancel that". DO NOT fire delete_last when the user names a specific category, vendor, date, or amount. If the user says "delete X" where X is a category name from the list below, fire **delete_category** instead. If X is a date/amount/counterparty, fire smalltalk asking which transaction.

"delete_category": user wants to permanently remove a *category* from the system. Examples: "delete Office Cashflow category", "remove the Logistics category", "o'chir Logistika kategoriyasini", "удали категорию маркетинг". Set category_key to the matching key from the available categories. If you can't match it confidently, set category_key to null and set followup_question asking which category they mean. Set confirmation to a short sentence in user's language.

"create_category": user wants to add a new category to the system ("add a category called Truck Rental", "yangi kategoriya qo'shamiz: yuk mashinasi", "создай категорию для маркетинга"). Provide labels in **all three languages** — translate yourself. kind: "income" or "expense" if the user said which; null if they didn't, then set followup_question to ask. Set confirmation to a short sentence in user's language ("Created category: Truck Rental (expense).").

"show_picker": user wants to OPEN the report period picker without specifying a period yet ("open reports", "show me reports", "hisobot ko'rsat", "покажи отчёты", "report menu"). Use this when the user wants the menu, not a specific period.

"show_recent": user wants to see their recent transactions ("show recent", "what did I log", "yozuvlar", "последние записи", "show me my transactions", "list my last entries"). The bot will reply with a list of the last 5 transactions and tap-to-delete buttons.

"change_language": user wants to switch the bot's language ("switch to russian", "change to english", "tilni ruschaga o'zgartir", "сделай узбекский", "speak english"). Set target_language to "uz" | "ru" | "en".

"smalltalk": greeting, help, thanks, anything not above. Set "reply" to a short helpful message in user's language. Mention what the bot can do (log income/expense, give reports, fix or delete last entry, create new categories, open menus by voice).

CRITICAL: Never silently guess key facts. If amount or kind is genuinely unclear, set followup_question. NEVER make up data.

Numbers: handle "1.2 mln", "1 200 000", "1,2 млн", "1.2 m", "500к", "500k", "yarim million" (= 500 000), "1 mln 200" (= 1 200 000).

Categories available (use the "key" field):
{{CATEGORIES}}
`;

function buildSystemPrompt(categories: Category[]): string {
  const today = format(new Date(), "yyyy-MM-dd");
  const lines = categories.map(
    (c) =>
      `  - key: ${c.key} (kind: ${c.kind}) labels: en="${c.label_en}" ru="${c.label_ru}" uz="${c.label_uz}"`,
  );
  return SYSTEM
    .replace("{{TODAY}}", today)
    .replace("{{CATEGORIES}}", lines.join("\n"));
}

export type IntentContext = {
  hasLastTransaction: boolean;
};

export async function parseIntent(
  userText: string,
  categories: Category[],
  ctx: IntentContext = { hasLastTransaction: false },
): Promise<ParsedIntent> {
  const system = buildSystemPrompt(categories);
  const userTextWithCtx =
    userText +
    (ctx.hasLastTransaction
      ? "\n\n[context: the user has a recently saved transaction that can be edited or deleted]"
      : "");

  const raw = await generateJson<unknown>({
    systemInstruction: system,
    userParts: [{ text: userTextWithCtx }],
    responseSchema,
  });

  return intentSchema.parse(raw);
}
