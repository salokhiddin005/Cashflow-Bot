"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createOtp,
  createPasswordResetToken,
  createUser,
  createWorkspace,
  findTelegramForUser,
  findUserByEmail,
  findUserById,
  findUserByPhone,
  findUserByTgUsername,
  getClaimToken,
  getOtp,
  getPasswordResetToken,
  getWorkspaceByUserId,
  incrementOtpAttempts,
  markClaimTokenUsed,
  markOtpUsed,
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
import {
  generateOtp,
  hashOtp,
  otpExpiry,
  otpMatches,
  OTP_MAX_ATTEMPTS,
} from "@/lib/auth/otp";
import { sendPasswordResetEmail } from "@/lib/email/sender";
import { dmTelegramUser, formatOtpMessage } from "@/lib/bot/dm";

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

// ─── Forgot password — email channel (Resend) ────────────────────────────

export type ForgotResult =
  | { ok: true; message: string; devLink?: string }
  | { ok: false; error: string };

const RESET_HOURS = 2;

// Email reset. Looks up the user, mints a token, mails a link via Resend.
// In dev (no RESEND_API_KEY), surfaces the link inline so testing works.
export async function forgotPasswordEmailAction(_prev: ForgotResult | null, formData: FormData): Promise<ForgotResult> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  if (!identifier) return { ok: false, error: "Enter your email" };

  const guess = guessIdentifier(identifier);
  if (!guess || guess.kind !== "email") {
    return { ok: false, error: "That doesn't look like an email address" };
  }

  const user = await findUserByEmail(guess.value);

  if (user?.email) {
    const token = newToken();
    await createPasswordResetToken({
      token,
      user_id: user.id,
      channel: "email",
      expires_at: tokenExpiry(RESET_HOURS),
    });

    const base = (process.env.APP_BASE_URL?.trim() || "").replace(/\/$/, "")
      || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
    const link = `${base}/reset-password/${token}`;

    const result = await sendPasswordResetEmail({ to: user.email, resetUrl: link });
    if (!result.sent && result.devLink) {
      return { ok: true, message: "Reset link generated (RESEND_API_KEY not set — link shown for dev).", devLink: result.devLink };
    }
    if (!result.sent) {
      console.warn("[reset] email send failed:", result.reason);
      // Don't leak the failure to the caller — phishing risk.
    }
  }

  // Same response whether the account exists or not — no user enumeration.
  return {
    ok: true,
    message: "If a matching account exists, you'll get an email with a reset link shortly. Check your spam folder.",
  };
}

// ─── Forgot password — phone channel (Telegram-OTP) ──────────────────────

export type PhoneOtpRequestResult =
  | { ok: true; otp_id: number; message: string }
  | { ok: false; error: string };

// Step 1 of the phone reset: user types their phone, we look up their
// linked Telegram chat, generate a 6-digit code, hash + store it, DM the
// code to the user via the bot. Returns an `otp_id` the next step uses.
export async function forgotPasswordPhoneRequestAction(
  _prev: PhoneOtpRequestResult | null,
  formData: FormData,
): Promise<PhoneOtpRequestResult> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  if (!identifier) return { ok: false, error: "Enter your phone number" };

  const guess = guessIdentifier(identifier);
  if (!guess || guess.kind !== "phone") {
    return { ok: false, error: "That doesn't look like a phone number" };
  }

  const user = await findUserByPhone(guess.value);
  if (!user) {
    // We're explicit here (vs the email path) because the user needs to
    // know to enter a different number — silently "succeeding" would
    // strand them on the OTP screen with no code arriving.
    return { ok: false, error: "No account with that phone number" };
  }

  const tg = await findTelegramForUser(user.id);
  if (!tg) {
    return {
      ok: false,
      error:
        "This account isn't linked to Telegram. Use the email reset, or send /reset to the bot to get a link.",
    };
  }

  const code = generateOtp();
  const { id } = await createOtp({
    user_id: user.id,
    code_hash: hashOtp(code),
    expires_at: otpExpiry(),
  });

  const lang = (tg.language_code === "uz" || tg.language_code === "ru") ? tg.language_code : "en";
  const sent = await dmTelegramUser(tg.telegram_id, formatOtpMessage(code, lang));

  if (!sent) {
    // In dev with no bot token, surface the code so we can still test.
    if (process.env.NODE_ENV !== "production") {
      return { ok: true, otp_id: id, message: `Code (dev): ${code}` };
    }
    return { ok: false, error: "Couldn't send the code via Telegram. Try email reset instead." };
  }

  return { ok: true, otp_id: id, message: "We sent a 6-digit code to your Telegram chat with the bot." };
}

export type PhoneOtpVerifyResult = { ok: true } | { ok: false; error: string };

// Step 2: user types the 6-digit code. On success we redirect them straight
// to /reset-password/[token] with a fresh long token — they set the password
// there and we sign them in. The OTP itself can't be reused.
export async function forgotPasswordPhoneVerifyAction(
  _prev: PhoneOtpVerifyResult | null,
  formData: FormData,
): Promise<PhoneOtpVerifyResult> {
  const otpId = Number(formData.get("otp_id"));
  const code = String(formData.get("code") ?? "").trim();
  if (!Number.isFinite(otpId) || !code) {
    return { ok: false, error: "Missing code or session" };
  }

  const otp = await getOtp(otpId);
  if (!otp) return { ok: false, error: "That request has expired — start over." };
  if (otp.used_at) return { ok: false, error: "This code has already been used." };
  if (isExpired(otp.expires_at)) return { ok: false, error: "Code expired — request a new one." };
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "Too many wrong attempts. Request a new code." };
  }

  if (!otpMatches(code, otp.code_hash)) {
    await incrementOtpAttempts(otpId);
    const left = OTP_MAX_ATTEMPTS - otp.attempts - 1;
    return {
      ok: false,
      error: left > 0 ? `Wrong code — ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many wrong attempts.",
    };
  }

  await markOtpUsed(otpId);

  const token = newToken();
  await createPasswordResetToken({
    token,
    user_id: otp.user_id,
    channel: "phone",
    expires_at: tokenExpiry(RESET_HOURS),
  });
  redirect(`/reset-password/${token}`);
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
