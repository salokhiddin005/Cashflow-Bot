import { execute } from "./client";

type Seed = {
  key: string;
  kind: "income" | "expense";
  label_uz: string;
  label_ru: string;
  label_en: string;
  color: string;
  icon: string;
  sort_order: number;
};

const DEFAULTS: Seed[] = [
  // Income
  { key: "sales",          kind: "income",  label_uz: "Sotuv",        label_ru: "Продажи",     label_en: "Sales",       color: "#10b981", icon: "shopping-bag",   sort_order: 10 },
  { key: "services",       kind: "income",  label_uz: "Xizmatlar",    label_ru: "Услуги",      label_en: "Services",    color: "#14b8a6", icon: "briefcase",      sort_order: 20 },
  { key: "investment",     kind: "income",  label_uz: "Investitsiya", label_ru: "Инвестиции",  label_en: "Investment",  color: "#06b6d4", icon: "trending-up",    sort_order: 30 },
  { key: "other_income",   kind: "income",  label_uz: "Boshqa",       label_ru: "Прочее",      label_en: "Other",       color: "#64748b", icon: "circle",         sort_order: 90 },
  // Expense
  { key: "salary",         kind: "expense", label_uz: "Ish haqi",     label_ru: "Зарплата",    label_en: "Payroll",     color: "#f59e0b", icon: "users",          sort_order: 10 },
  { key: "rent",           kind: "expense", label_uz: "Ijara",        label_ru: "Аренда",      label_en: "Rent",        color: "#8b5cf6", icon: "home",           sort_order: 20 },
  { key: "logistics",      kind: "expense", label_uz: "Logistika",    label_ru: "Логистика",   label_en: "Logistics",   color: "#3b82f6", icon: "truck",          sort_order: 30 },
  { key: "inventory",      kind: "expense", label_uz: "Tovar",        label_ru: "Товар",       label_en: "Inventory",   color: "#0ea5e9", icon: "package",        sort_order: 40 },
  { key: "utilities",      kind: "expense", label_uz: "Kommunal",     label_ru: "Коммуналка",  label_en: "Utilities",   color: "#22d3ee", icon: "zap",            sort_order: 50 },
  { key: "marketing",      kind: "expense", label_uz: "Reklama",      label_ru: "Реклама",     label_en: "Marketing",   color: "#ec4899", icon: "megaphone",      sort_order: 60 },
  { key: "tax",            kind: "expense", label_uz: "Soliq",        label_ru: "Налоги",      label_en: "Tax",         color: "#ef4444", icon: "landmark",       sort_order: 70 },
  { key: "other_expense",  kind: "expense", label_uz: "Boshqa",       label_ru: "Прочее",      label_en: "Other",       color: "#64748b", icon: "circle",         sort_order: 90 },
];

export async function seedWorkspaceCategories(workspaceId: number) {
  for (const r of DEFAULTS) {
    await execute(
      `INSERT INTO categories (workspace_id, key, kind, label_uz, label_ru, label_en, color, icon, sort_order, is_system)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)
       ON CONFLICT (workspace_id, key) DO NOTHING`,
      [workspaceId, r.key, r.kind, r.label_uz, r.label_ru, r.label_en, r.color, r.icon, r.sort_order],
    );
  }
}
