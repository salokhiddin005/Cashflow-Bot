import { queryOne } from "../db/client";

export type BotStats = {
  totalUsers: number;
  monthlyActive: number;
  weeklyActive: number;
  dailyActive: number;
  newThisMonth: number;
};

const toNum = (v: unknown): number => (typeof v === "string" ? Number(v) : (v as number));

// Single round-trip that returns every count we care about. Cheap because
// telegram_users is tiny (one row per bot user) and last_seen_at is indexed.
export async function getBotStats(): Promise<BotStats> {
  const r = await queryOne<{
    total: string;
    mau: string;
    wau: string;
    dau: string;
    new_30: string;
  }>(
    `SELECT
       COUNT(*)                                                                                    AS total,
       COUNT(*) FILTER (WHERE last_seen_at >= to_char((now() - interval '30 days') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) AS mau,
       COUNT(*) FILTER (WHERE last_seen_at >= to_char((now() - interval '7 days')  AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) AS wau,
       COUNT(*) FILTER (WHERE last_seen_at >= to_char((now() - interval '1 day')   AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) AS dau,
       COUNT(*) FILTER (WHERE created_at   >= to_char((now() - interval '30 days') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) AS new_30
     FROM telegram_users`,
  );
  return {
    totalUsers: toNum(r!.total),
    monthlyActive: toNum(r!.mau),
    weeklyActive: toNum(r!.wau),
    dailyActive: toNum(r!.dau),
    newThisMonth: toNum(r!.new_30),
  };
}

// Format the bot's "About" / description text — what shows under the bot
// name in the chat header on Telegram clients that surface it. Kept short
// because some clients truncate at ~120 chars.
export function formatBotDescription(stats: BotStats): string {
  const n = stats.monthlyActive.toLocaleString();
  return `${n} monthly user${stats.monthlyActive === 1 ? "" : "s"} · Track business cashflow by voice or text in UZ/RU/EN`;
}

// Push the current stats to Telegram via setMyDescription. Returns true on
// success — the cron/manual trigger reports failure to console but never
// throws (so a stale description doesn't block anything else).
export async function refreshBotDescription(): Promise<{ ok: true; stats: BotStats } | { ok: false; reason: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, reason: "no-bot-token" };

  let stats: BotStats;
  try {
    stats = await getBotStats();
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "stats-failed" };
  }

  const description = formatBotDescription(stats);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setMyDescription`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description }),
    });
    const json = await res.json();
    if (!json.ok) return { ok: false, reason: json.description ?? "telegram-rejected" };
    return { ok: true, stats };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "fetch-failed" };
  }
}
