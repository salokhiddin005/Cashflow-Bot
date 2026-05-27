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

// Each nav item gets a distinct warm accent. The active bar, the active
// background wash, and the icon all share the same hue — so the eye reads
// the section by colour. All four hues sit in the warm half of the wheel
// so they harmonise rather than compete.
type Tone = {
  iconActive: string;   // icon color when this nav item is the current page
  iconRest:   string;   // icon color when idle (gentle tint, not gray)
  bgActive:   string;   // background wash when active
  bar:        string;   // left accent bar gradient
  hoverBg:    string;   // hover tint
  hoverIcon:  string;   // icon color on hover (when not active)
};

const TONES: Record<string, Tone> = {
  overview: {
    iconActive: "text-amber-600 dark:text-amber-400",
    iconRest:   "text-amber-500/70 dark:text-amber-400/60",
    bgActive:   "bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent",
    bar:        "bg-gradient-to-b from-amber-500 to-orange-500",
    hoverBg:    "hover:bg-amber-500/10",
    hoverIcon:  "group-hover:text-amber-600 dark:group-hover:text-amber-400",
  },
  transactions: {
    iconActive: "text-rose-600 dark:text-rose-400",
    iconRest:   "text-rose-500/70 dark:text-rose-400/60",
    bgActive:   "bg-gradient-to-r from-rose-500/15 via-rose-500/5 to-transparent",
    bar:        "bg-gradient-to-b from-rose-500 to-pink-500",
    hoverBg:    "hover:bg-rose-500/10",
    hoverIcon:  "group-hover:text-rose-600 dark:group-hover:text-rose-400",
  },
  analytics: {
    iconActive: "text-orange-600 dark:text-orange-400",
    iconRest:   "text-orange-500/70 dark:text-orange-400/60",
    bgActive:   "bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-transparent",
    bar:        "bg-gradient-to-b from-orange-500 to-red-500",
    hoverBg:    "hover:bg-orange-500/10",
    hoverIcon:  "group-hover:text-orange-600 dark:group-hover:text-orange-400",
  },
  categories: {
    iconActive: "text-fuchsia-600 dark:text-fuchsia-400",
    iconRest:   "text-fuchsia-500/70 dark:text-fuchsia-400/60",
    bgActive:   "bg-gradient-to-r from-fuchsia-500/15 via-fuchsia-500/5 to-transparent",
    bar:        "bg-gradient-to-b from-fuchsia-500 to-pink-500",
    hoverBg:    "hover:bg-fuchsia-500/10",
    hoverIcon:  "group-hover:text-fuchsia-600 dark:group-hover:text-fuchsia-400",
  },
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
  const tone = TONES[iconName] ?? TONES.overview;

  return (
    <Link
      href={href}
      className={clsx(
        "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-200 focus-ring",
        active
          ? clsx(tone.bgActive, "text-[--color-foreground] shadow-sm")
          : clsx(
              "text-[--color-muted] hover:translate-x-0.5 hover:text-[--color-foreground]",
              tone.hoverBg,
            ),
      )}
    >
      {/* Active accent bar — toned to the section's colour */}
      <span
        aria-hidden
        className={clsx(
          "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full transition-all duration-200",
          tone.bar,
          active ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0",
        )}
      />
      <Icon
        className={clsx(
          "h-4 w-4 shrink-0 transition-all duration-200",
          active ? tone.iconActive : clsx(tone.iconRest, tone.hoverIcon, "group-hover:scale-110"),
        )}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}
