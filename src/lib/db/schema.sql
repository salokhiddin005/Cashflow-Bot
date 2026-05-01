-- Multi-tenant schema for Cashflow Manager.
-- Every user gets their own workspace + categories + transactions.
-- Authentication: email / phone / Telegram username (any one is enough).
-- Telegram users get a workspace as soon as they /start the bot, then claim
-- it from the dashboard via a one-time signed link.

-- One-time wipe: detects the legacy single-tenant schema (a `workspace`
-- table without a sibling `users` table) and drops it before recreating.
-- After that, every CREATE below is IF NOT EXISTS so cold starts are safe.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='workspace')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users')
  THEN
    DROP TABLE IF EXISTS bot_chat_state CASCADE;
    DROP TABLE IF EXISTS transactions CASCADE;
    DROP TABLE IF EXISTS telegram_users CASCADE;
    DROP TABLE IF EXISTS categories CASCADE;
    DROP TABLE IF EXISTS workspace CASCADE;
  END IF;
END $$;

-- ─── Users & sessions ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  email           TEXT UNIQUE,
  phone           TEXT UNIQUE,
  tg_username     TEXT UNIQUE,
  password_hash   TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  CHECK (email IS NOT NULL OR phone IS NOT NULL OR tg_username IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token       TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL CHECK (channel IN ('email','phone','telegram')),
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

-- Short numeric one-time codes for phone reset (delivered via Telegram bot
-- DM rather than SMS). Stored hashed; capped at 5 attempts before lockout
-- so the 6-digit codespace can't be brute-forced.
CREATE TABLE IF NOT EXISTS password_reset_otps (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);
CREATE INDEX IF NOT EXISTS idx_otp_user ON password_reset_otps(user_id);

-- ─── Workspaces (one per user) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspaces (
  id                    SERIAL PRIMARY KEY,
  -- nullable: a workspace exists for a Telegram user before they claim it.
  user_id               INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL DEFAULT 'My Business',
  base_currency         TEXT NOT NULL DEFAULT 'UZS',
  starting_balance      BIGINT NOT NULL DEFAULT 0,
  starting_balance_at   TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
  timezone              TEXT NOT NULL DEFAULT 'Asia/Tashkent',
  created_at            TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id) WHERE user_id IS NOT NULL;

-- ─── Telegram users (linked to a workspace, optionally to a real user) ─────

CREATE TABLE IF NOT EXISTS telegram_users (
  id              SERIAL PRIMARY KEY,
  telegram_id     BIGINT NOT NULL UNIQUE,
  workspace_id    INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username        TEXT,
  first_name      TEXT,
  last_name       TEXT,
  language_code   TEXT,
  created_at      TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

-- One-time link the bot sends so a TG user can claim/sign up for their dashboard.
CREATE TABLE IF NOT EXISTS telegram_claim_tokens (
  token            TEXT PRIMARY KEY,
  telegram_user_id INTEGER NOT NULL REFERENCES telegram_users(id) ON DELETE CASCADE,
  workspace_id     INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  expires_at       TEXT NOT NULL,
  used_at          TEXT,
  created_at       TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);
CREATE INDEX IF NOT EXISTS idx_claim_tokens_tg ON telegram_claim_tokens(telegram_user_id);

-- ─── Categories (per workspace) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id           SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key          TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('income','expense')),
  label_uz     TEXT NOT NULL,
  label_ru     TEXT NOT NULL,
  label_en     TEXT NOT NULL,
  color        TEXT NOT NULL DEFAULT '#64748b',
  icon         TEXT NOT NULL DEFAULT 'circle',
  is_archived  INTEGER NOT NULL DEFAULT 0,
  is_system    INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 100,
  created_at   TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  UNIQUE (workspace_id, key)
);
CREATE INDEX IF NOT EXISTS idx_categories_workspace ON categories(workspace_id);

-- ─── Transactions (per workspace) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
  id                  SERIAL PRIMARY KEY,
  workspace_id        INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind                TEXT NOT NULL CHECK (kind IN ('income','expense')),
  amount              BIGINT NOT NULL CHECK (amount > 0),
  currency            TEXT NOT NULL DEFAULT 'UZS',
  original_amount     BIGINT,
  original_currency   TEXT,
  fx_rate             DOUBLE PRECISION,
  category_id         INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  occurred_on         TEXT NOT NULL,
  note                TEXT,
  source              TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web','telegram')),
  telegram_user_id    INTEGER REFERENCES telegram_users(id) ON DELETE SET NULL,
  created_at          TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  updated_at          TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE INDEX IF NOT EXISTS idx_tx_workspace    ON transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tx_occurred_on  ON transactions(workspace_id, occurred_on);
CREATE INDEX IF NOT EXISTS idx_tx_category     ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_tx_kind         ON transactions(workspace_id, kind);

-- ─── Bot per-chat state (chat = telegram chat, scoped to workspace via TG user) ─

CREATE TABLE IF NOT EXISTS bot_chat_state (
  chat_id              BIGINT PRIMARY KEY,
  last_transaction_id  INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  pending_intent       TEXT,
  updated_at           TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);
