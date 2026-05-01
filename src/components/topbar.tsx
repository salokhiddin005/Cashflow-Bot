import { TelegramHelpButton } from "./telegram-help";
import { ThemeSwitcher } from "./theme-switcher";
import { getCurrentUserAndWorkspace } from "@/lib/auth/session";

// Topbar carries workspace branding, theme picker, and the Telegram help
// pop-up. Sign Out lives in the sidebar's account block instead — keeps
// the topbar uncluttered and Sign Out always one click away.
export async function Topbar() {
  const ctx = await getCurrentUserAndWorkspace();
  if (!ctx) return null;
  const { workspace } = ctx;

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-[--color-border] bg-[--color-background]/85 px-6 backdrop-blur lg:px-10">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-[--color-muted]">Workspace</span>
        <span className="rounded-md bg-[--color-surface-2] px-2 py-1 text-[13px] font-medium">{workspace.name}</span>
      </div>
      <div className="flex items-center gap-3">
        <ThemeSwitcher />
        <TelegramHelpButton />
      </div>
    </header>
  );
}
