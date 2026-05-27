// Optional helper: drop a handful of realistic transactions in so the dashboard
// doesn't render empty for first-time reviewers. Run with `npx tsx scripts/seed-sample-data.ts`.

import "./_env";
import { format, subDays } from "date-fns";
import {
  createTransaction,
  getCategoryByKey,
  updateWorkspace,
} from "../src/lib/db/queries";
import { createWorkspace } from "../src/lib/db/auth-queries";
import { query } from "../src/lib/db/client";

type Sample = {
  daysAgo: number;
  kind: "income" | "expense";
  amount: number;
  categoryKey: string;
  note?: string;
};

const SAMPLES: Sample[] = [
  // Last 30 days of activity for a small wholesale-style business.
  { daysAgo: 0,  kind: "income",  amount: 4_200_000, categoryKey: "sales",     note: "Akbar Logistics — invoice #1042" },
  { daysAgo: 0,  kind: "expense", amount: 380_000,   categoryKey: "logistics", note: "Yandex Go — 3 deliveries" },
  { daysAgo: 1,  kind: "expense", amount: 12_000_000,categoryKey: "salary",    note: "Payroll — March" },
  { daysAgo: 2,  kind: "income",  amount: 1_850_000, categoryKey: "services",  note: "Consulting — Bek Karimov" },
  { daysAgo: 3,  kind: "expense", amount: 850_000,   categoryKey: "marketing", note: "Instagram boost" },
  { daysAgo: 4,  kind: "expense", amount: 6_500_000, categoryKey: "rent",      note: "Office April" },
  { daysAgo: 5,  kind: "expense", amount: 2_200_000, categoryKey: "inventory", note: "Bulk order — coffee" },
  { daysAgo: 6,  kind: "income",  amount: 980_000,   categoryKey: "sales" },
  { daysAgo: 7,  kind: "expense", amount: 480_000,   categoryKey: "utilities", note: "Electric + water" },
  { daysAgo: 8,  kind: "income",  amount: 3_400_000, categoryKey: "sales" },
  { daysAgo: 9,  kind: "expense", amount: 320_000,   categoryKey: "logistics" },
  { daysAgo: 10, kind: "expense", amount: 220_000,   categoryKey: "marketing" },
  { daysAgo: 12, kind: "income",  amount: 2_100_000, categoryKey: "sales" },
  { daysAgo: 14, kind: "expense", amount: 1_400_000, categoryKey: "tax",       note: "VAT" },
  { daysAgo: 16, kind: "income",  amount: 1_300_000, categoryKey: "services" },
  { daysAgo: 18, kind: "expense", amount: 410_000,   categoryKey: "logistics" },
  { daysAgo: 20, kind: "expense", amount: 18_000_000,categoryKey: "logistics", note: "Special truck rental — DUBAI return" },
  { daysAgo: 22, kind: "income",  amount: 5_100_000, categoryKey: "sales",     note: "Big retail order" },
  { daysAgo: 24, kind: "expense", amount: 690_000,   categoryKey: "inventory" },
  { daysAgo: 26, kind: "income",  amount: 760_000,   categoryKey: "services" },
  { daysAgo: 28, kind: "expense", amount: 540_000,   categoryKey: "marketing" },
  { daysAgo: 30, kind: "income",  amount: 2_800_000, categoryKey: "sales" },
];

async function main() {
  // Pick the most recently-created workspace, or create a brand-new
  // unclaimed one for demo purposes if the DB is empty.
  const rows = await query<{ id: string }>("SELECT id FROM workspaces ORDER BY id DESC LIMIT 1");
  const workspaceId = rows[0] ? Number(rows[0].id) : (await createWorkspace(null, "Bizness Hisobchi Demo")).id;
  await updateWorkspace(workspaceId, { starting_balance: 35_000_000, name: "Bizness Hisobchi Demo" });

  for (const s of SAMPLES) {
    const cat = await getCategoryByKey(workspaceId, s.categoryKey);
    if (!cat) { console.warn("missing category", s.categoryKey); continue; }
    await createTransaction({
      workspace_id: workspaceId,
      kind: s.kind,
      amount: s.amount,
      category_id: cat.id,
      occurred_on: format(subDays(new Date(), s.daysAgo), "yyyy-MM-dd"),
      note: s.note,
      source: "web",
    });
  }
  console.log(`✓ Inserted ${SAMPLES.length} sample transactions into workspace ${workspaceId}.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
