import { randomBytes } from "node:crypto";

// Cryptographically random URL-safe token. 32 bytes → 43 base64url chars,
// far above the brute-force threshold for short-lived single-use tokens.
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function tokenExpiry(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

export function isExpired(isoString: string): boolean {
  const t = Date.parse(isoString);
  return Number.isNaN(t) || t < Date.now();
}
