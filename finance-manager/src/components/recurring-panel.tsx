import { format, parseISO } from "date-fns";
import { Repeat, Bell, AlertCircle } from "lucide-react";
import { Card, CardBody, CardHeader, Pill } from "./ui";
import { detectRecurring } from "@/lib/insights";
import { requireUserWorkspace } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";

const cadenceWord = (l: "weekly" | "biweekly" | "monthly") =>
  l === "weekly" ? "weekly" : l === "biweekly" ? "every 2 weeks" : "monthly";

export async function RecurringPanel({ limit = 5 }: { limit?: number }) {
  const { workspace } = await requireUserWorkspace();
  const all = await detectRecurring(workspace.id);
  // Hide low-confidence in the main view; render up to `limit`
  const items = all.filter((r) => r.confidence !== "low").slice(0, limit);

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-[--color-muted]" />
            <div className="text-sm font-semibold">Recurring patterns</div>
          </div>
          <div className="mt-0.5 text-[12px] text-[--color-muted]">
            We&apos;ll spot recurring rent, payroll, and subscriptions automatically.
          </div>
        </CardHeader>
        <CardBody className="px-0 py-0">
          <div className="flex flex-col items-center px-5 py-10 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-emerald-500/15 to-teal-500/15 text-emerald-600 dark:text-emerald-300">
              <Repeat className="h-6 w-6 animate-float" />
            </div>
            <div className="mt-3 text-[14px] font-semibold">Patterns coming soon</div>
            <div className="mt-1 max-w-xs text-[12.5px] text-[--color-muted]">
              Log a few weeks of transactions and I&apos;ll start spotting your rent, payroll, and subscriptions automatically. 🔍
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-[--color-muted]" />
          <div className="text-sm font-semibold">Recurring patterns</div>
        </div>
        <div className="mt-0.5 text-[12px] text-[--color-muted]">
          Detected from your history — confidence based on consistency.
        </div>
      </CardHeader>
      <CardBody className="px-0 py-0">
        <ul className="divide-y divide-[--color-border]">
          {items.map((r) => {
            const due = r.daysUntilNext;
            const dueLabel =
              due < 0 ? `${Math.abs(due)}d overdue`
              : due === 0 ? "due today"
              : due === 1 ? "due tomorrow"
              : `in ${due}d`;
            const dueTone =
              due < 0 ? "danger"
              : due <= 3 ? "warning"
              : due <= 7 ? "accent"
              : "neutral";
            const Icon = due < 0 ? AlertCircle : Bell;
            return (
              <li key={r.category_id} className="flex items-center gap-3 px-5 py-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: r.category_color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-medium">{r.category_label_en}</span>
                    <Pill tone={r.kind === "income" ? "success" : "neutral"}>{r.kind}</Pill>
                    {r.confidence === "medium" ? <Pill tone="neutral">~{cadenceWord(r.cadenceLabel)}</Pill> : <Pill tone="accent">{cadenceWord(r.cadenceLabel)}</Pill>}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[--color-muted]">
                    <span>~{formatMoney(r.averageAmount)}</span>
                    <span>·</span>
                    <span>{r.occurrences}× in 180d</span>
                    <span>·</span>
                    <span>last {format(parseISO(r.lastDate), "d MMM")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-right">
                  <Icon className="h-3.5 w-3.5 text-[--color-muted-2]" />
                  <Pill tone={dueTone}>{dueLabel}</Pill>
                </div>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
