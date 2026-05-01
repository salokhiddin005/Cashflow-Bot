import { Resend } from "resend";

// Resend client — created lazily so it doesn't crash at import time when
// RESEND_API_KEY is missing in dev. Calls log a warning + the link instead
// of sending so the password-reset flow still works locally.
let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

// Default sender — Resend's onboarding domain works without DNS verification.
// Bring your own once you have a domain in Resend (e.g. "Sahifa <noreply@yourdomain.com>").
const FROM = process.env.RESEND_FROM?.trim() || "Sahifa <onboarding@resend.dev>";

export type SendResult = { sent: true } | { sent: false; reason: string; devLink?: string };

// Sends the password-reset email. In dev (no API key), returns the link
// inline so it can be surfaced on the page — production silently no-ops
// to avoid leaking whether an account exists.
export async function sendPasswordResetEmail(input: {
  to: string;
  resetUrl: string;
}): Promise<SendResult> {
  const r = getResend();
  if (!r) {
    // Dev convenience: surface the link inline so testing works without
    // SMTP. NEVER expose it in production — that would let any visitor
    // reset any account by typing in the email. Production with no key
    // returns a generic "couldn't send" reason; the action then falls
    // through to the same generic "if an account exists…" message it
    // would return for a non-existent email, so no enumeration leak.
    console.log(`[email][${process.env.NODE_ENV}] reset link for ${input.to}:`, input.resetUrl);
    if (process.env.NODE_ENV !== "production") {
      return { sent: false, reason: "no-api-key", devLink: input.resetUrl };
    }
    return { sent: false, reason: "no-api-key" };
  }
  try {
    const result = await r.emails.send({
      from: FROM,
      to: input.to,
      subject: "Reset your Sahifa password",
      html: passwordResetHtml(input.resetUrl),
      text: passwordResetText(input.resetUrl),
    });
    if (result.error) {
      console.error("[email] resend error", result.error);
      return { sent: false, reason: result.error.message ?? "send-failed" };
    }
    return { sent: true };
  } catch (e) {
    console.error("[email] threw", e);
    return { sent: false, reason: e instanceof Error ? e.message : "send-failed" };
  }
}

function passwordResetHtml(url: string): string {
  return `<!doctype html>
<html lang="en">
<body style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; background:#fdf0d5; padding:32px;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:480px;margin:0 auto;background:#fff8e7;border:1px solid #e0c896;border-radius:14px;padding:32px;">
    <tr><td>
      <h1 style="margin:0 0 12px;font-size:20px;color:#1c1410;">Reset your password</h1>
      <p style="margin:0 0 16px;color:#3b2c22;line-height:1.55;">Click the button below to choose a new password. The link expires in 2 hours.</p>
      <p style="margin:24px 0;text-align:center;">
        <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#f97316,#f43f5e);color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">Reset password</a>
      </p>
      <p style="margin:0 0 4px;color:#7d6b53;font-size:13px;">Or copy this link into your browser:</p>
      <p style="margin:0 0 16px;color:#7d6b53;font-size:12px;word-break:break-all;">${url}</p>
      <p style="margin:24px 0 0;color:#a89880;font-size:12px;">If you didn't request this, ignore this email — no changes will be made.</p>
    </td></tr>
  </table>
</body>
</html>`;
}

function passwordResetText(url: string): string {
  return [
    "Reset your Sahifa password",
    "",
    "Click the link below to choose a new password. It expires in 2 hours.",
    "",
    url,
    "",
    "If you didn't request this, you can ignore this email.",
  ].join("\n");
}
