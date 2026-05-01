"use client";

import { Sun, Coffee, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { clsx } from "clsx";

export type Theme = "honey" | "day" | "night";

const STORAGE_KEY = "cf-theme";

function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
}

// Three-pill segmented switcher. Lives in the topbar (and on the auth
// header so signed-out users can pick too). Persists to localStorage and
// applies the theme on click — no reload required.
export function ThemeSwitcher() {
  // Don't render an active state on the server to avoid hydration mismatch.
  // The <html data-theme=…> is set by the inline init script in
  // app/layout.tsx, so the colors are already correct on first paint.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const saved = (typeof window !== "undefined"
      ? (localStorage.getItem(STORAGE_KEY) as Theme | null)
      : null);
    setTheme(saved ?? "honey");
  }, []);

  const choose = (t: Theme) => {
    setTheme(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
    applyTheme(t);
  };

  const items: { key: Theme; Icon: typeof Sun; label: string }[] = [
    { key: "day",   Icon: Sun,    label: "Day" },
    { key: "honey", Icon: Coffee, label: "Honey" },
    { key: "night", Icon: Moon,   label: "Night" },
  ];

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-[--color-border] bg-[--color-surface] p-0.5 shadow-sm">
      {items.map(({ key, Icon, label }) => {
        const active = theme === key;
        return (
          <button
            key={key}
            type="button"
            aria-label={`${label} theme`}
            aria-pressed={active}
            title={`${label} mode`}
            onClick={() => choose(key)}
            className={clsx(
              "inline-flex h-7 w-7 items-center justify-center rounded-[5px] transition-all duration-200",
              active
                ? "bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white shadow-[0_2px_8px_-2px_rgba(234,88,12,0.5)]"
                : "text-[--color-muted] hover:bg-[--color-surface-2] hover:text-[--color-foreground]",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
