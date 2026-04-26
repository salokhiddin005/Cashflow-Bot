-- Postgres schema for the Business Finance Manager.
-- Single-tenant per database. Multi-user is supported through telegram_users.
-- Designed to run safely on first boot (every CREATE is IF NOT EXISTS).

-- Note: amounts and Telegram IDs use BIGINT — Telegram chat/user ids exceed
-- 32-bit, and UZS amounts can be very large.

CREATE TABLE IF NOT EXISTS workspace (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  name                  TEXT NOT NULL DEFAULT 'My Business',
  base_currency         TEXT NOT NULL DEFAULT 'UZS',
  starting_balance      BIGINT NOT NULL DEFAULT 0,
  starting_balance_at   TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
  timezone              TEXT NOT NULL DEFAULT 'Asia/Tashkent',
  created_at            TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

INSERT INTO workspace (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  kind        TEXT NOT NULL CHECK (kind IN ('income','expense')),
  label_uz    TEXT NOT NULL,
  label_ru    TEXT NOT NULL,
  label_en    TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#64748b',
  icon        TEXT NOT NULL DEFAULT 'circle',
  is_archived INTEGER NOT NULL DEFAULT 0,
  is_system   INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 100,
  created_at  TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS telegram_users (
  id              SERIAL PRIMARY KEY,
  telegram_id     BIGINT NOT NULL UNIQUE,
  username        TEXT,
  first_name      TEXT,
  last_name       TEXT,
  language_code   TEXT,
  created_at      TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS transactions (
  id                  SERIAL PRIMARY KEY,
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

CREATE INDEX IF NOT EXISTS idx_tx_occurred_on ON transactions(occurred_on);
CREATE INDEX IF NOT EXISTS idx_tx_category    ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_tx_kind        ON transactions(kind);

-- Per-chat conversation state for the bot (last tx for "delete that" / "fix that",
-- plus pending intent for multi-turn flows like create_category and the wizard).
CREATE TABLE IF NOT EXISTS bot_chat_state (
  chat_id              BIGINT PRIMARY KEY,
  last_transaction_id  INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  pending_intent       TEXT,
  updated_at           TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);
