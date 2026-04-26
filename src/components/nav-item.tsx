"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { LayoutDashboard, ListTree, BarChart3, Tags, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  transactions: ListTree,
  analytics: BarChart3,
  categories: Tags,
};

export function NavItem({
  href,
  iconName,
  label,
  exact,
}: {
  href: string;
  iconName: keyof typeof ICONS;
  label: string;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  const Icon = ICONS[iconName];
  return (
    <Link
      href={href}
      className={clsx(
        // Relative so the active accent bar (positioned absolutely) lays in front.
        "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-200 focus-ring",
        active
          ? "bg-gradient-to-r from-indigo-500/10 to-transparent text-[--color-foreground] shadow-sm shadow-indigo-500/5"
          : "text-[--color-muted] hover:bg-[--color-surface-2] hover:text-[--color-foreground] hover:translate-x-0.5",
      )}
    >
      {/* Active accent bar — slides into view */}
      <span
        aria-hidden
        className={clsx(
          "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-indigo-500 to-violet-500 transition-all duration-200",
          active ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0",
        )}
      />
      <Icon
        className={clsx(
          "h-4 w-4 shrink-0 transition-transform duration-200",
          active ? "text-indigo-500 dark:text-indigo-400" : "group-hover:scale-110",
        )}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}
