import { execute, query, queryOne } from "./client";
import { seedWorkspaceCategories } from "./seed";
import type { ResetChannel, Session, User, Workspace } from "./types";

const toNum = (v: unknown): number => (typeof v === "string" ? Number(v) : (v as number));

function fixUser(r: User): User {
  return { ...r, id: toNum(r.id) };
}
function fixWorkspace(r: Workspace): Workspace {
  return {
    ...r,
    id: toNum(r.id),
    user_id: r.user_id == null ? null : toNum(r.user_id),
    starting_balance: toNum(r.starting_balance),
  };
}

// ─── Users ────────────────────────────────────────────────────────────────

export async function createUser(input: {
  email: string | null;
  phone: string | null;
  tg_username: string | null;
  password_hash: string;
}): Promise<User> {
  const r = await queryOne<User>(
    `INSERT INTO users (email, phone, tg_username, password_hash)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [input.email, input.phone, input.tg_username, input.password_hash],
  );
  return fixUser(r!);
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const r = await queryOne<User>("SELECT * FROM users WHERE email = $1", [email]);
  return r ? fixUser(r) : undefined;
}

export async function findUserByPhone(phone: string): Promise<User | undefined> {
  const r = await queryOne<User>("SELECT * FROM users WHERE phone = $1", [phone]);
  return r ? fixUser(r) : undefined;
}

export async function findUserByTgUsername(name: string): Promise<User | undefined> {
  const r = await queryOne<User>("SELECT * FROM users WHERE tg_username = $1", [name]);
  return r ? fixUser(r) : undefined;
}

export async function findUserById(id: number): Promise<User | undefined> {
  const r = await queryOne<User>("SELECT * FROM users WHERE id = $1", [id]);
  return r ? fixUser(r) : undefined;
}

export async function updateUserPassword(userId: number, passwordHash: string): Promise<void> {
  await execute("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);
}

// ─── Workspaces ──────────────────────────────────────────────────────────

// Create a workspace owned by `userId` (nullable — used for unclaimed bot
// workspaces). Seeds the default income/expense categories so the user has
// something to work with on day one.
export async function createWorkspace(userId: number | null, name = "My Business"): Promise<Workspace> {
  const r = await queryOne<Workspace>(
    `INSERT INTO workspaces (user_id, name) VALUES ($1, $2) RETURNING *`,
    [userId, name],
  );
  const ws = fixWorkspace(r!);
  await seedWorkspaceCategories(ws.id);
  return ws;
}

export async function getWorkspaceById(id: number): Promise<Workspace | undefined> {
  const r = await queryOne<Workspace>("SELECT * FROM workspaces WHERE id = $1", [id]);
  return r ? fixWorkspace(r) : undefined;
}

export async function getWorkspaceByUserId(userId: number): Promise<Workspace | undefined> {
  const r = await queryOne<Workspace>(
    "SELECT * FROM workspaces WHERE user_id = $1 ORDER BY id ASC LIMIT 1",
    [userId],
  );
  return r ? fixWorkspace(r) : undefined;
}

export async function setWorkspaceOwner(workspaceId: number, userId: number): Promise<void> {
  await execute("UPDATE workspaces SET user_id = $1 WHERE id = $2", [userId, workspaceId]);
}

// ─── Sessions ────────────────────────────────────────────────────────────

export async function createSession(token: string, userId: number, expiresAt: string): Promise<Session> {
  const r = await queryOne<Session>(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3) RETURNING *`,
    [token, userId, expiresAt],
  );
  return { ...r!, user_id: toNum(r!.user_id) };
}

export async function getSession(token: string): Promise<Session | undefined> {
  const r = await queryOne<Session>("SELECT * FROM sessions WHERE id = $1", [token]);
  return r ? { ...r, user_id: toNum(r.user_id) } : undefined;
}

export async function deleteSession(token: string): Promise<void> {
  await execute("DELETE FROM sessions WHERE id = $1", [token]);
}

export async function deleteExpiredSessions(): Promise<void> {
  await execute("DELETE FROM sessions WHERE expires_at < $1", [new Date().toISOString()]);
}

// ─── Password reset tokens ───────────────────────────────────────────────

export async function createPasswordResetToken(input: {
  token: string;
  user_id: number;
  channel: ResetChannel;
  expires_at: string;
}): Promise<void> {
  await execute(
    `INSERT INTO password_reset_tokens (token, user_id, channel, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [input.token, input.user_id, input.channel, input.expires_at],
  );
}

export type ResetTokenRow = {
  token: string;
  user_id: number;
  channel: ResetChannel;
  expires_at: string;
  used_at: string | null;
};

export async function getPasswordResetToken(token: string): Promise<ResetTokenRow | undefined> {
  const r = await queryOne<ResetTokenRow>(
    "SELECT token, user_id, channel, expires_at, used_at FROM password_reset_tokens WHERE token = $1",
    [token],
  );
  return r ? { ...r, user_id: toNum(r.user_id) } : undefined;
}

export async function markPasswordResetTokenUsed(token: string): Promise<void> {
  await execute(
    `UPDATE password_reset_tokens SET used_at = $1 WHERE token = $2`,
    [new Date().toISOString(), token],
  );
}

// ─── Telegram claim tokens ───────────────────────────────────────────────

export async function createClaimToken(input: {
  token: string;
  telegram_user_id: number;
  workspace_id: number;
  expires_at: string;
}): Promise<void> {
  await execute(
    `INSERT INTO telegram_claim_tokens (token, telegram_user_id, workspace_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [input.token, input.telegram_user_id, input.workspace_id, input.expires_at],
  );
}

export type ClaimTokenRow = {
  token: string;
  telegram_user_id: number;
  workspace_id: number;
  expires_at: string;
  used_at: string | null;
};

export async function getClaimToken(token: string): Promise<ClaimTokenRow | undefined> {
  const r = await queryOne<ClaimTokenRow>(
    "SELECT token, telegram_user_id, workspace_id, expires_at, used_at FROM telegram_claim_tokens WHERE token = $1",
    [token],
  );
  return r
    ? { ...r, telegram_user_id: toNum(r.telegram_user_id), workspace_id: toNum(r.workspace_id) }
    : undefined;
}

export async function markClaimTokenUsed(token: string): Promise<void> {
  await execute(
    `UPDATE telegram_claim_tokens SET used_at = $1 WHERE token = $2`,
    [new Date().toISOString(), token],
  );
}

// Find the most recent unused claim token for a Telegram user, if any. Used
// by the bot's "/dashboard" command so we can re-issue the same active link
// instead of cluttering the DB with new tokens on every tap.
export async function findActiveClaimTokenForTelegramUser(telegramUserId: number): Promise<ClaimTokenRow | undefined> {
  const r = await queryOne<ClaimTokenRow>(
    `SELECT token, telegram_user_id, workspace_id, expires_at, used_at
     FROM telegram_claim_tokens
     WHERE telegram_user_id = $1 AND used_at IS NULL AND expires_at > $2
     ORDER BY created_at DESC LIMIT 1`,
    [telegramUserId, new Date().toISOString()],
  );
  return r
    ? { ...r, telegram_user_id: toNum(r.telegram_user_id), workspace_id: toNum(r.workspace_id) }
    : undefined;
}

// Used by the bot's /start so we can also surface "your dashboard is at …"
// for users who already claimed without rummaging through tokens.
export async function findClaimedUserForTelegram(telegramUserId: number): Promise<{ user_id: number } | undefined> {
  const r = await queryOne<{ user_id: number }>(
    "SELECT user_id FROM telegram_users WHERE id = $1 AND user_id IS NOT NULL",
    [telegramUserId],
  );
  return r ? { user_id: toNum(r.user_id) } : undefined;
}

export async function _listAll(): Promise<{ users: number; workspaces: number }> {
  const u = await query<{ n: string }>("SELECT COUNT(*) AS n FROM users");
  const w = await query<{ n: string }>("SELECT COUNT(*) AS n FROM workspaces");
  return { users: toNum(u[0].n), workspaces: toNum(w[0].n) };
}
