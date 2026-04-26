import type { Category, Lang } from "../db/types";

export const SUPPORTED_LANGS: Lang[] = ["uz", "ru", "en"];

export function categoryLabel(c: Pick<Category, "label_uz" | "label_ru" | "label_en">, lang: Lang): string {
  if (lang === "uz") return c.label_uz;
  if (lang === "ru") return c.label_ru;
  return c.label_en;
}

// Heuristic language detection over short messages. The LLM also detects
// language, but this gives the bot a sensible default before the LLM call.
const CYRILLIC = /[Ѐ-ӿ]/;
const UZ_LATIN_HINTS = /\b(soldim|oldim|kirim|chiqim|haqida|so['']m|bugun|kecha|men|hisobot|qancha|necha)\b/i;
const RU_HINTS = /\b(сегодня|вчера|купил|потратил|доход|расход|сум|сум.|отчет|отчёт|сколько)\b/iu;

export function detectLanguage(text: string): Lang {
  const t = text.trim();
  if (!t) return "en";
  if (RU_HINTS.test(t) || (CYRILLIC.test(t) && !UZ_LATIN_HINTS.test(t))) return "ru";
  if (UZ_LATIN_HINTS.test(t)) return "uz";
  return "en";
}
