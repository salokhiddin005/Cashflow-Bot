import { format, parseISO, startOfWeek, addDays, differenceInDays } from "date-fns";
import { Card, CardBody, CardHeader } from "./ui";
import { dailySeriesFilled } from "@/lib/insights";
import { requireUserWorkspace } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";

// Renders a GitHub-contributions-style calendar heatmap of the last ~13 weeks.
// Color = net flow (green for income-heavy, red for expense-heavy, gray empty).
export async function ActivityHeatmap({ weeks = 13 }: { weeks?: number }) {
  const { workspace } = await requireUserWorkspace();
  const today = new Date();
  // Anchor end date to *Sunday* of this week so we always show full weeks.
  const endOfThisWeek = addDays(startOfWeek(today, { weekStartsOn: 1 }), 6);
  const startDate = addDays(endOfThisWeek, -(weeks * 7) + 1);
  const data = await dailySeriesFilled(workspace.id, format(startDate, "yyyy-MM-dd"), format(endOfThisWeek, "yyyy-MM-dd"));

  // Group days into columns (weeks). Each column has 7 cells (Mon..Sun).
  const cols: typeof data[number][][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: typeof data = [];
    for (let d = 0; d < 7; d++) {
      const idx = w * 7 + d;
      if (data[idx]) col.push(data[idx]);
    }
    cols.push(col);
  }

  // Color scale: green for net > 0, red for net < 0, gray for zero.
  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.net)));
  const color = (net: number) => {
    if (net === 0) return "var(--color-surface-2)";
    const ratio = Math.min(1, Math.abs(net) / maxAbs);
    // Smoothstep-ish brightness: 0.18 → 0.95
    const a = 0.18 + ratio * 0.77;
    return net > 0
      ? `rgba(16, 185, 129, ${a})`   // emerald-500
      : `rgba(239, 68, 68, ${a})`;   // red-500
  };

  // Find month labels — show month name above the first column of each new month.
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  cols.forEach((col, i) => {
    const day = col[0]?.day;
    if (!day) return;
    const m = parseISO(day).getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ col: i, label: format(parseISO(day), "MMM") });
      lastMonth = m;
    }
  });

  const todayIso = format(today, "yyyy-MM-dd");
  const totalNet = data.reduce((s, d) => s + d.net, 0);
  const activeDays = data.filter((d) => d.count > 0).length;
  const totalDays = data.length;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Activity</div>
          <div className="mt-0.5 text-[12px] text-[--color-muted]">
            Last {weeks} weeks · {activeDays}/{totalDays} active days · net {totalNet >= 0 ? "+" : "−"}{formatMoney(Math.abs(totalNet))}
          </div>
        </div>
        <div className="hidden items-center gap-1 text-[11px] text-[--color-muted] sm:flex">
          <span>less</span>
          <div className="h-2.5 w-3 rounded-sm" style={{ background: "var(--color-surface-2)" }} />
          <div className="h-2.5 w-3 rounded-sm" style={{ background: "rgba(239, 68, 68, 0.55)" }} />
          <div className="h-2.5 w-3 rounded-sm" style={{ background: "rgba(16, 185, 129, 0.55)" }} />
          <div className="h-2.5 w-3 rounded-sm" style={{ background: "rgba(16, 185, 129, 0.95)" }} />
          <span>more</span>
        </div>
      </CardHeader>
      <CardBody>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Month labels row */}
            <div className="mb-1 flex pl-7 text-[10px] text-[--color-muted-2]">
              {cols.map((_, i) => {
                const m = monthLabels.find((l) => l.col === i);
                return (
                  <div key={i} className="w-[14px]">
                    {m ? <span>{m.label}</span> : null}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-[3px]">
              {/* Day-of-week labels */}
              <div className="flex flex-col gap-[3px] pr-1.5 text-[10px] text-[--color-muted-2]">
                {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((l, i) => (
                  <div key={i} className="h-[11px] leading-[11px]">{l}</div>
                ))}
              </div>
              {cols.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-[3px]">
                  {col.map((d) => {
                    const isToday = d.day === todayIso;
                    const tooltip = d.count
                      ? `${format(parseISO(d.day), "EEE, d MMM yyyy")}\n${d.count} tx · net ${d.net >= 0 ? "+" : "−"}${formatMoney(Math.abs(d.net))}`
                      : `${format(parseISO(d.day), "EEE, d MMM yyyy")}\nno activity`;
                    return (
                      <div
                        key={d.day}
                        title={tooltip}
                        className="h-[11px] w-[11px] rounded-[2px]"
                        style={{
                          background: color(d.net),
                          outline: isToday ? "1.5px solid var(--color-foreground)" : undefined,
                          outlineOffset: isToday ? -1 : undefined,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// Suppress an unused import warning when these helpers stay imported but unused
// in some bundles. Harmless; bundler tree-shakes either way.
export const _heatmapDeps = { startOfWeek, differenceInDays };
