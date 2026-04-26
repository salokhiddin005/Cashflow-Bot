import { execute, queryOne } from "../db/client";

export type ChatState = {
  chat_id: number;
  last_transaction_id: number | null;
  pending_intent: string | null;
  updated_at: string;
};

export async function getChatState(chatId: number): Promise<ChatState | null> {
  const row = await queryOne<ChatState>(
    "SELECT * FROM bot_chat_state WHERE chat_id = $1",
    [chatId],
  );
  return row ?? null;
}

export async function setLastTransaction(chatId: number, txId: number | null) {
  await execute(
    `INSERT INTO bot_chat_state (chat_id, last_transaction_id) VALUES ($1, $2)
     ON CONFLICT (chat_id) DO UPDATE SET
       last_transaction_id = EXCLUDED.last_transaction_id,
       updated_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
    [chatId, txId],
  );
}

export async function setPendingIntent(chatId: number, pending: unknown | null) {
  const json = pending == null ? null : JSON.stringify(pending);
  await execute(
    `INSERT INTO bot_chat_state (chat_id, pending_intent) VALUES ($1, $2)
     ON CONFLICT (chat_id) DO UPDATE SET
       pending_intent = EXCLUDED.pending_intent,
       updated_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
    [chatId, json],
  );
}
