"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";

export function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  function hrefFor(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    return `${pathname}?${next.toString()}`;
  }
  return (
    <div className="flex items-center justify-between border-t border-[--color-border] px-5 py-3 text-[12.5px] text-[--color-muted]">
      <div>
        Page <span className="font-medium text-[--color-foreground]">{page}</span> of{" "}
        <span className="font-medium text-[--color-foreground]">{totalPages}</span>{" "}
        · {total.toLocaleString()} transactions
      </div>
      <div className="flex items-center gap-1">
        <PagerLink href={hrefFor(Math.max(1, page - 1))} disabled={page <= 1}>
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </PagerLink>
        <PagerLink href={hrefFor(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
          Next <ChevronRight className="h-3.5 w-3.5" />
        </PagerLink>
      </div>
    </div>
  );
}

function PagerLink({ href, disabled, children }: { href: string; disabled?: boolean; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[--color-border] px-2.5 py-1 opacity-40">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex items-center gap-1 rounded-md border border-[--color-border] bg-[--color-surface] px-2.5 py-1 hover:bg-[--color-surface-2]",
      )}
    >
      {children}
    </Link>
  );
}
