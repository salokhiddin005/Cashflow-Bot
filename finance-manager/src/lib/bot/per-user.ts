import {
  createClaimToken,
  createWorkspace,
  findActiveClaimTokenForTelegramUser,
  getWorkspaceById,
} from "../db/auth-queries";
import {
  getTelegramUserByTelegramId,
  upsertTelegramUser,
} from "../db/queries";
import { newToken, tokenExpiry } from "../auth/tokens";
import type { TelegramUser, Workspace } from "../db/types";

const CLAIM_TOKEN_TTL_HOURS = 24 * 30; // 30 days

function appBaseUrl(): string | null {
  const base = (process.env.APP_BASE_URL?.trim() || "").replace(/\/$/, "");
  // Telegram inline URL buttons must be HTTPS — drop the link in local dev.
  return /^https:\/\//.test(base) ? base : null;
}

export type BotUserContext = {
  tgUser: TelegramUser;
  workspace: Workspace;
};

// Resolve (or create) the workspace that this Telegram user logs to. Called
// before every bot turn so we always have a workspace_id to pass to queries.
// First-time users get a fresh empty workspace; on subsequent calls we just
// look it up. Workspace identity is stable for the life of the TG account.
export async function ensureBotContext(input: {
  telegram_id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  language_code?: string | null;
}): Promise<BotUserContext> {
  const existing = await getTelegramUserByTelegramId(input.telegram_id);
  let workspaceId = existing?.workspace_id;
  if (!workspaceId) {
    const ws = await createWorkspace(null, "My Business");
    workspaceId = ws.id;
  }
  const tgUser = await upsertTelegramUser({
    telegram_id: input.telegram_id,
    workspace_id: workspaceId,
    username: input.username ?? null,
    first_name: input.first_name ?? null,
    last_name: input.last_name ?? null,
    language_code: input.language_code ?? null,
  });
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) throw new Error(`Workspace ${workspaceId} disappeared`);
  return { tgUser, workspace };
}

// The URL we show the user when they ask for their dashboard. If they've
// already linked a real account, send them to /login (they sign in there).
// Otherwise issue a one-time claim link bound to their workspace.
//
// Returns null in local dev when APP_BASE_URL isn't HTTPS — the caller drops
// the inline button so Telegram doesn't reject the message.
export async function getDashboardUrlForBotUser(tgUser: TelegramUser): Promise<string | null> {
  const base = appBaseUrl();
  if (!base) return null;

  if (tgUser.user_id) {
    return `${base}/login`;
  }

  // Reuse an active token if one's already out there — saves the user
  // confusion if they tap an old link first.
  const existing = await findActiveClaimTokenForTelegramUser(tgUser.id);
  let token: string;
  if (existing) {
    token = existing.token;
  } else {
    token = newToken();
    await createClaimToken({
      token,
      telegram_user_id: tgUser.id,
      workspace_id: tgUser.workspace_id,
      expires_at: tokenExpiry(CLAIM_TOKEN_TTL_HOURS),
    });
  }
  const tgParam = tgUser.username ? `?tg=${encodeURIComponent(tgUser.username)}` : "";
  return `${base}/claim/${token}${tgParam}`;
}
