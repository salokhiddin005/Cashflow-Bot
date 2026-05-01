import { LogOut } from "lucide-react";
import { TelegramHelpButton } from "./telegram-help";
import { ThemeSwitcher } from "./theme-switcher";
import { Button } from "./ui";
import { getCurrentUserAndWorkspace } from "@/lib/auth/session";
import { logoutAction } from "@/app/actions";

export async function Topbar() {
  const ctx = await getCurrentUserAndWorkspace();
  if (!ctx) return null;
  const { user, workspace } = ctx;
  const identity = user.email ?? user.phone ?? (user.tg_username ? `@${user.tg_username}` : "Account");

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-[--color-border] bg-[--color-background]/85 px-6 backdrop-blur lg:px-10">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-[--color-muted]">Workspace</span>
        <span className="rounded-md bg-[--color-surface-2] px-2 py-1 text-[13px] font-medium">{workspace.name}</span>
      </div>
      <div className="flex items-center gap-3">
        <ThemeSwitcher />
        <TelegramHelpButton />
        <span className="hidden text-[12.5px] text-[--color-muted] sm:inline">{identity}</span>
        <form action={logoutAction}>
          <Button type="submit" variant="secondary" size="sm" title="Sign out">
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
