import Link from "next/link";
import { Wallet } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[--color-background] text-[--color-foreground]">
      <header className="flex items-center justify-between px-6 py-5 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[--color-brand] text-[--color-brand-foreground]">
            <Wallet className="h-4 w-4" />
          </div>
          <span>Sahifa</span>
        </Link>
        <ThemeSwitcher />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center sm:pt-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
