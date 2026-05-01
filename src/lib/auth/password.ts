import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Node's built-in scrypt — no extra dependency, well-vetted. Format stored as
// `scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>` so future parameter changes can
// re-hash on next login without invalidating existing accounts.
const N = 16384, r = 8, p = 1, KEYLEN = 64;

export function hashPassword(plain: string): string {
  if (!plain || plain.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEYLEN, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const got = scryptSync(plain, salt, expected.length, {
    N: Number(nStr),
    r: Number(rStr),
    p: Number(pStr),
    maxmem: 64 * 1024 * 1024,
  });
  if (got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}
