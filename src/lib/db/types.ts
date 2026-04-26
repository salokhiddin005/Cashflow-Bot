export type Kind = "income" | "expense";
export type Lang = "uz" | "ru" | "en";
export type Source = "web" | "telegram";

export type Workspace = {
  id: 1;
  name: string;
  base_currency: string;
  starting_balance: number;
  starting_balance_at: string;
  timezone: string;
  created_at: string;
};

export type Category = {
  id: number;
  key: string;
  kind: Kind;
  label_uz: string;
  label_ru: string;
  label_en: string;
  color: string;
  icon: string;
  is_archived: 0 | 1;
  is_system: 0 | 1;
  sort_order: number;
  created_at: string;
};

export type TelegramUser = {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language_code: Lang | null;
  created_at: string;
};

export type Transaction = {
  id: number;
  kind: Kind;
  amount: number;
  currency: string;
  original_amount: number | null;
  original_currency: string | null;
  fx_rate: number | null;
  category_id: number;
  occurred_on: string;
  note: string | null;
  source: Source;
  telegram_user_id: number | null;
  created_at: string;
  updated_at: string;
};

export type TransactionWithCategory = Transaction & {
  category_key: string;
  category_label_en: string;
  category_label_uz: string;
  category_label_ru: string;
  category_color: string;
  category_icon: string;
};
