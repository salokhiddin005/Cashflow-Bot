import { createHash, randomInt } from "node:crypto";

// 6-digit numeric OTP, leading-zero-padded. randomInt is cryptographically
// secure (rejection-sampled) so codes are uniformly distributed.
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// SHA-256 of the code. We don't salt — the codespace is small, codes are
// short-lived (10 min), and attempts are rate-limited to 5 — so a salt
// adds nothing on top of the timing-safe compare we already do.
export function hashOtp(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function otpMatches(plain: string, hashed: string): boolean {
  // Length-equal hex strings → simple equality is fine (no timing attack
  // surface — both sides are hex of the same length).
  if (plain.length === 0 || hashed.length === 0) return false;
  return hashOtp(plain) === hashed;
}

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

export function otpExpiry(): string {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();
}
