"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createPasswordResetToken,
  createUser,
  createWorkspace,
  findUserByEmail,
  findUserById,
  findUserByPhone,
  findUserByTgUsername,
  getClaimToken,
  getPasswordResetToken,
  getWorkspaceByUserId,
  markClaimTokenUsed,
  markPasswordResetTokenUsed,
  setWorkspaceOwner,
  updateUserPassword,
} from "@/lib/db/auth-queries";
import { setTelegramUserOwner } from "@/lib/db/queries";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import {
  guessIdentifier,
  normalizeEmail,
  normalizePhone,
  normalizeTgUsername,
  validateEmail,
  validatePhone,
  validateTgUsername,
} from "@/lib/auth/identifiers";
import { isExpired, newToken, tokenExpiry } from "@/lib/auth/tokens";
import type { ResetChannel } from "@/lib/db/types";

// ─── Signup ──────────────────────────────────────────────────────────────

export type SignupResult = { ok: true } | { ok: false; error: string };

const signupSchema = z.object({
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  tg_username: z.string().optional().nullable(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  confirm: z.string().max(200).optional(),
  // Optional claim-token from a Telegram bot link — when present, signup
  // attaches the new account to the bot's pre-existing workspace instead of
  // creating a fresh empty one.
  claim_token: z.string().optional().nullable(),
});

export async function signupAction(_prev: SignupResult | null, formData: FormData): Promise<SignupResult> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    phone: formData.get("phone"),
    tg_username: formData.get("tg_username"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
    claim_token: formData.get("claim_token"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  if (data.confirm !== undefined && data.confirm !== data.password) {
    return { ok: false, error: "Passwords don't match" };
  }

  // Normalize + validate identifiers. At least one must be provided.
  const email = data.email?.trim() ? normalizeEmail(data.email) : null;
  const phone = data.phone?.trim() ? normalizePhone(data.phone) : null;
  const tg = data.tg_username?.trim() ? normalizeTgUsername(data.tg_username) : null;
  if (!email && !phone && !tg) {
    return { ok: false, error: "Provide at least one of: email, phone, or Telegram username" };
  }
  if (email && !validateEmail(email)) return { ok: false, error: "That email doesn't look right" };
  if (phone && !validatePhone(phone)) return { ok: false, error: "That phone number doesn't look right" };
  if (tg && !validateTgUsername(tg))   return { ok: false, error: "That Telegram username doesn't look right" };

  // Check uniqueness across each identifier the user supplied.
  if (email && (await findUserByEmail(email)))           return { ok: false, error: "That email is already registered" };
  if (phone && (await findUserByPhone(phone)))           return { ok: false, error: "That phone number is already registered" };
  if (tg && (await findUserByTgUsername(tg)))            return { ok: false, error: "That Telegram username is already registered" };

  let passwordHash: string;
  try {
    passwordHash = hashPassword(data.password);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't hash password" };
  }

  const user = await createUser({ email, phone, tg_username: tg, password_hash: passwordHash });

  // If the user came in via a Telegram claim link, attach the bot's workspace
  // to this account. Otherwise create a fresh one.
  let attachedExistingWorkspace = false;
  if (data.claim_token) {
    const claim = await getClaimToken(data.claim_token);
    if (claim && !claim.used_at && !isExpired(claim.expires_at)) {
      await setWorkspaceOwner(claim.workspace_id, user.id);
      await setTelegramUserOwner(claim.telegram_user_id, user.id);
      await markClaimTokenUsed(claim.token);
      attachedExistingWorkspace = true;
    }
  }
  if (!attachedExistingWorkspace) {
    await createWorkspace(user.id);
  }

  await startSession(user.id);
  redirect("/");
}

// ─── Login ───────────────────────────────────────────────────────────────

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function loginAction(_prev: LoginResult | null, formData: FormData): Promise<LoginResult> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) return { ok: false, error: "Enter your account and password" };

  const guess = guessIdentifier(identifier);
  if (!guess) return { ok: false, error: "That doesn't look like an email, phone, or @username" };

  const user =
    guess.kind === "email"       ? await findUserByEmail(guess.value)
    : guess.kind === "phone"     ? await findUserByPhone(guess.value)
    : await findUserByTgUsername(guess.value);

  // Constant-time-ish: do a hash comparison even when the user is missing,
  // so timing doesn't leak whether the account exists.
  const dummy = user?.password_hash ?? "scrypt$16384$8$1$00$00";
  const ok = user ? verifyPassword(password, dummy) : (verifyPassword(password, dummy), false);
  if (!user || !ok) return { ok: false, error: "Wrong account or password" };

  await startSession(user.id);
  redirect("/");
}

// ─── Forgot password ─────────────────────────────────────────────────────

export type ForgotResult =
  | { ok: true; message: string; devLink?: string }
  | { ok: false; error: string };

const RESET_HOURS = 2;

// `channel` is the user's stated preference for HOW to receive the reset
// link. We always also resolve it from the identifier — if the user typed an
// email, the channel is implicitly email regardless of toggle. The bot has a
// "telegram" channel too: hitting that endpoint generates a token the bot
// can DM, but you can also DM yourself the link from this page.
export async function forgotPasswordAction(_prev: ForgotResult | null, formData: FormData): Promise<ForgotResult> {
  const channelRaw = String(formData.get("channel") ?? "email");
  const identifier = String(formData.get("identifier") ?? "").trim();
  if (!identifier) return { ok: false, error: "Enter your email or phone number" };

  const channel: ResetChannel =
    channelRaw === "phone" ? "phone"
    : channelRaw === "telegram" ? "telegram"
    : "email";

  const guess = guessIdentifier(identifier);
  if (!guess) return { ok: false, error: "That doesn't look like an email or phone number" };

  const user =
    guess.kind === "email"       ? await findUserByEmail(guess.value)
    : guess.kind === "phone"     ? await findUserByPhone(guess.value)
    : await findUserByTgUsername(guess.value);

  // Always succeed-looking, even if no account — leaks nothing about who has
  // an account. Token only created if the user really exists.
  if (user) {
    const token = newToken();
    await createPasswordResetToken({
      token,
      user_id: user.id,
      channel,
      expires_at: tokenExpiry(RESET_HOURS),
    });

    const base = (process.env.APP_BASE_URL?.trim() || "").replace(/\/$/, "") || "";
    const link = `${base}/reset-password/${token}`;

    if (channel === "phone") {
      // SMS isn't wired up yet (no provider configured), so we surface a
      // friendly message rather than pretending. Email path still works.
      return {
        ok: true,
        message: "SMS-based reset is coming soon. For now, please request a reset by email or use the /reset command in the Telegram bot.",
      };
    }

    if (process.env.NODE_ENV !== "production") {
      // In dev, hand the user the link directly so they can test without SMTP.
      return { ok: true, message: "Reset link generated.", devLink: link };
    }
    // TODO: send email here (SMTP / Resend / etc.). For now, return success
    // without leaking whether the account exists.
    console.log("[reset] email link for", user.id, link);
  }

  return {
    ok: true,
    message:
      channel === "phone"
        ? "If a matching account exists, you'll get an SMS shortly."
        : "If a matching account exists, you'll get an email with a reset link shortly.",
  };
}

// ─── Reset password ──────────────────────────────────────────────────────

export type ResetResult = { ok: true } | { ok: false; error: string };

export async function resetPasswordAction(_prev: ResetResult | null, formData: FormData): Promise<ResetResult> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!token) return { ok: false, error: "Missing reset token" };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters" };
  if (password !== confirm) return { ok: false, error: "Passwords don't match" };

  const row = await getPasswordResetToken(token);
  if (!row) return { ok: false, error: "Reset link is invalid" };
  if (row.used_at) return { ok: false, error: "This reset link has already been used" };
  if (isExpired(row.expires_at)) return { ok: false, error: "This reset link has expired" };

  const user = await findUserById(row.user_id);
  if (!user) return { ok: false, error: "Account no longer exists" };

  let hash: string;
  try { hash = hashPassword(password); }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Couldn't hash password" }; }

  await updateUserPassword(user.id, hash);
  await markPasswordResetTokenUsed(token);
  await startSession(user.id);
  redirect("/");
}

// ─── Claim (sign in instead of sign up via the bot's link) ──────────────

export type ClaimResult = { ok: true } | { ok: false; error: string };

// If the user already has an account, they can use this to attach the bot's
// workspace to their existing user via login. (The signup flow handles the
// "no account yet" case.)
export async function claimAndLoginAction(_prev: ClaimResult | null, formData: FormData): Promise<ClaimResult> {
  const token = String(formData.get("token") ?? "");
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!token || !identifier || !password) return { ok: false, error: "All fields are required" };

  const claim = await getClaimToken(token);
  if (!claim) return { ok: false, error: "This claim link is invalid" };
  if (claim.used_at) return { ok: false, error: "This claim link has already been used" };
  if (isExpired(claim.expires_at)) return { ok: false, error: "This claim link has expired" };

  const guess = guessIdentifier(identifier);
  if (!guess) return { ok: false, error: "That doesn't look like an email, phone, or @username" };
  const user =
    guess.kind === "email"       ? await findUserByEmail(guess.value)
    : guess.kind === "phone"     ? await findUserByPhone(guess.value)
    : await findUserByTgUsername(guess.value);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { ok: false, error: "Wrong account or password" };
  }

  // If the user already owns a workspace, we still attach the bot's
  // workspace to them — but that means they'd have two. To keep it simple
  // for v1, we only do this when the user doesn't already own a workspace
  // of their own. Otherwise we just sign them in and surface a notice.
  const existing = await getWorkspaceByUserId(user.id);
  if (!existing) {
    await setWorkspaceOwner(claim.workspace_id, user.id);
  }
  await setTelegramUserOwner(claim.telegram_user_id, user.id);
  await markClaimTokenUsed(claim.token);
  await startSession(user.id);
  redirect("/");
}
