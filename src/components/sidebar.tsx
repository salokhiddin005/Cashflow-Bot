import Link from "next/link";
import { LogOut, Wallet } from "lucide-react";
import { NavItem } from "./nav-item";
import { Button } from "./ui";
import { getCurrentUserAndWorkspace } from "@/lib/auth/session";
import { logoutAction } from "@/app/actions";

const NAV = [
  { href: "/",             label: "Overview",     iconName: "overview" as const,     exact: true },
  { href: "/transactions", label: "Transactions", iconName: "transactions" as const },
  { href: "/analytics",    label: "Analytics",    iconName: "analytics" as const },
  { href: "/categories",   label: "Categories",   iconName: "categories" as const },
];

export async function Sidebar() {
  const ctx = await getCurrentUserAndWorkspace();
  const identity = ctx
    ? (ctx.user.email ?? ctx.user.phone ?? (ctx.user.tg_username ? `@${ctx.user.tg_username}` : "Account"))
    : null;

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

      {/* Account block — pinned to the bottom of the sidebar so Sign Out is
          always one click away regardless of which page you're on. */}
      <div className="border-t border-[--color-border] px-3 py-3">
        {identity ? (
          <div className="mb-2 flex items-center gap-2 px-2 text-[12px] text-[--color-muted]">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-[11px] font-semibold text-white">
              {identity.replace(/^@/, "").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-medium text-[--color-foreground]">
                Signed in
              </div>
              <div className="truncate text-[11.5px] text-[--color-muted]">{identity}</div>
            </div>
          </div>
        ) : null}
        <form action={logoutAction}>
          <Button type="submit" variant="danger" size="md" className="w-full">
            <LogOut className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
