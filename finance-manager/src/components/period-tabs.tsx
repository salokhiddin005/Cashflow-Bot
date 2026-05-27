"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { clsx } from "clsx";

const TABS = [
  { key: "this_month", label: "This month" },
  { key: "last_30",    label: "Last 30 days" },
  { key: "last_7",     label: "Last 7 days" },
  { key: "ytd",        label: "Year to date" },
];

export function PeriodTabs({ current }: { current: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <div className="inline-flex rounded-lg border border-[--color-border] bg-[--color-surface] p-1 text-[12.5px] shadow-sm">
      {TABS.map((t) => {
        const next = new URLSearchParams(params.toString());
        next.set("period", t.key);
        const active = current === t.key;
        return (
          <Link
            key={t.key}
            href={`${pathname}?${next.toString()}`}
            className={clsx(
              "relative rounded-md px-3 py-1.5 transition-all duration-200",
              active
                ? "bg-gradient-to-br from-amber-600 to-orange-600 font-medium text-white shadow-[0_2px_8px_-2px_rgba(217,119,6,0.5)]"
                : "text-[--color-muted] hover:text-[--color-foreground] hover:bg-[--color-surface-2]",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
