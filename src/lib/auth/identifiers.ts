// Normalize and validate the three login identifiers (email, phone, tg
// username). The same normalization is applied at signup AND at login so a
// user can sign up with "+998 90 123-45-67" and log in with "998901234567".

export type IdentifierKind = "email" | "phone" | "tg_username";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Telegram usernames: 5–32 chars, letters/digits/underscores, no leading
// digit. We accept with or without leading "@".
const TG_RE = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/;

export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

// Phone: keep digits only, accept optional leading "+". Doesn't enforce a
// country — user might have a local number — but strips spaces / dashes /
// parentheses so two encodings of the same number compare equal.
export function normalizePhone(s: string): string {
  const t = s.trim().replace(/[\s\-().]/g, "");
  if (t.startsWith("+")) return "+" + t.slice(1).replace(/\D/g, "");
  return t.replace(/\D/g, "");
}

export function normalizeTgUsername(s: string): string {
  return s.trim().replace(/^@/, "").toLowerCase();
}

export function validateEmail(s: string): boolean {
  return EMAIL_RE.test(s) && s.length <= 254;
}

export function validatePhone(s: string): boolean {
  // 7–15 digits, optionally with a leading +
  const digits = s.startsWith("+") ? s.slice(1) : s;
  return /^[0-9]{7,15}$/.test(digits);
}

export function validateTgUsername(s: string): boolean {
  return TG_RE.test(s);
}

// Try to figure out which kind of identifier the user typed in the unified
// "Email, phone, or @username" field. Tries email → phone → tg in order.
export type IdentifierGuess = {
  kind: IdentifierKind;
  value: string;
};

export function guessIdentifier(raw: string): IdentifierGuess | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@") && !trimmed.startsWith("@")) {
    const v = normalizeEmail(trimmed);
    return validateEmail(v) ? { kind: "email", value: v } : null;
  }
  // Anything starting with + or all-digits (with separators) is a phone.
  if (/^[+\d][\d\s\-().]*$/.test(trimmed)) {
    const v = normalizePhone(trimmed);
    return validatePhone(v) ? { kind: "phone", value: v } : null;
  }
  const v = normalizeTgUsername(trimmed);
  return validateTgUsername(v) ? { kind: "tg_username", value: v } : null;
}
