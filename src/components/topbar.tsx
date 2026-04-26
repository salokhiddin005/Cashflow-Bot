import { getWorkspace } from "@/lib/db/queries";
import { TelegramHelpButton } from "./telegram-help";

export async function Topbar() {
  const ws = await getWorkspace();
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-[--color-border] bg-[--color-background]/85 px-6 backdrop-blur lg:px-10">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-[--color-muted]">Workspace</span>
        <span className="rounded-md bg-[--color-surface-2] px-2 py-1 text-[13px] font-medium">{ws.name}</span>
      </div>
      <TelegramHelpButton />
    </header>
  );
}
