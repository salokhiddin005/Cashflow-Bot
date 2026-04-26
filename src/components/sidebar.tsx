import Link from "next/link";
import { Wallet } from "lucide-react";
import { NavItem } from "./nav-item";

const NAV = [
  { href: "/",             label: "Overview",     iconName: "overview" as const,     exact: true },
  { href: "/transactions", label: "Transactions", iconName: "transactions" as const },
  { href: "/analytics",    label: "Analytics",    iconName: "analytics" as const },
  { href: "/categories",   label: "Categories",   iconName: "categories" as const },
];

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-[--color-border] bg-[--color-surface] md:flex md:flex-col">
      <Link
        href="/"
        className="flex items-center gap-2.5 px-5 py-5 text-[15px] font-semibold tracking-tight"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[--color-brand] text-[--color-brand-foreground]">
          <Wallet className="h-4 w-4" />
        </div>
        <span>Sahifa</span>
      </Link>

      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-0.5">
          {NAV.map((item) => (
            <li key={item.href}>
              <NavItem href={item.href} iconName={item.iconName} label={item.label} exact={item.exact} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-[--color-border] px-5 py-4 text-xs text-[--color-muted]">
        <div className="font-medium text-[--color-foreground]">Need to log on the go?</div>
        <div className="mt-1">Talk to your bot on Telegram. Voice or text — both work.</div>
      </div>
    </aside>
  );
}
