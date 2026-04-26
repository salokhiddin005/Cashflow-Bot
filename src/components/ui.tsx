import { clsx } from "clsx";
import type { ComponentProps, ReactNode } from "react";

export function Card({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-[--color-border] bg-[--color-surface] shadow-[0_1px_0_rgba(0,0,0,0.02)]",
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({ className, ...rest }: ComponentProps<"div">) {
  return <div className={clsx("border-b border-[--color-border] px-5 py-4", className)} {...rest} />;
}

export function CardBody({ className, ...rest }: ComponentProps<"div">) {
  return <div className={clsx("px-5 py-4", className)} {...rest} />;
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 lg:mb-8 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-[--color-muted]">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "danger" | "warning" | "accent";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-[--color-surface-2] text-[--color-foreground] ring-1 ring-inset ring-[--color-border]",
    success: "bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-400",
    danger:  "bg-red-500/10 text-red-600 ring-1 ring-inset ring-red-500/20 dark:text-red-400",
    warning: "bg-amber-500/10 text-amber-600 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400",
    accent:  "bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-400",
  };
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", tones[tone])}>
      {children}
    </span>
  );
}

// Polished button system. Primary/danger now use a soft gradient with
// a layered shadow. All variants subtly lift on hover and press in on
// active. The "group" class on every button lets icon children opt
// into a hover-nudge with `group-hover:translate-x-0.5` etc.
export function Button({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
}) {
  const sizes: Record<string, string> = {
    sm: "h-8 px-2.5 text-[12px]",
    md: "h-9 px-3 text-[13px]",
    lg: "h-10 px-4 text-[13.5px]",
  };
  const variants: Record<string, string> = {
    primary:
      "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-[0_4px_14px_-4px_rgba(99,102,241,0.45)] " +
      "hover:from-indigo-500 hover:to-violet-500 hover:shadow-[0_8px_22px_-6px_rgba(99,102,241,0.55)] hover:-translate-y-0.5 " +
      "active:translate-y-0 active:shadow-[0_2px_8px_-2px_rgba(99,102,241,0.45)]",
    secondary:
      "border border-[--color-border] bg-[--color-surface] text-[--color-foreground] shadow-sm " +
      "hover:bg-[--color-surface-2] hover:shadow hover:-translate-y-0.5 " +
      "active:translate-y-0 active:shadow-sm",
    ghost:
      "text-[--color-foreground] hover:bg-[--color-surface-2] active:scale-[0.97]",
    danger:
      "bg-gradient-to-br from-rose-600 to-red-600 text-white shadow-[0_4px_14px_-4px_rgba(244,63,94,0.45)] " +
      "hover:from-rose-500 hover:to-red-500 hover:shadow-[0_8px_22px_-6px_rgba(244,63,94,0.55)] hover:-translate-y-0.5 " +
      "active:translate-y-0",
    success:
      "bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-[0_4px_14px_-4px_rgba(16,185,129,0.45)] " +
      "hover:from-emerald-500 hover:to-teal-500 hover:shadow-[0_8px_22px_-6px_rgba(16,185,129,0.55)] hover:-translate-y-0.5 " +
      "active:translate-y-0",
  };
  return (
    <button
      className={clsx(
        "group inline-flex items-center justify-center gap-1.5 rounded-md font-medium",
        "transition-[transform,box-shadow,background-color,opacity] duration-200 ease-out",
        "focus-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none",
        sizes[size],
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}

export function Input(props: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={clsx(
        "h-9 w-full rounded-md border border-[--color-border] bg-[--color-surface] px-3 text-sm text-[--color-foreground] placeholder:text-[--color-muted-2] focus-ring",
        props.className,
      )}
    />
  );
}

export function Select(props: ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={clsx(
        "h-9 rounded-md border border-[--color-border] bg-[--color-surface] px-3 pr-8 text-sm text-[--color-foreground] focus-ring",
        props.className,
      )}
    />
  );
}

export function Textarea(props: ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={clsx(
        "min-h-[72px] w-full rounded-md border border-[--color-border] bg-[--color-surface] px-3 py-2 text-sm text-[--color-foreground] placeholder:text-[--color-muted-2] focus-ring",
        props.className,
      )}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[--color-border] bg-[--color-surface] px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-[--color-muted-2]">{icon}</div> : null}
      <div className="text-base font-semibold">{title}</div>
      {description ? <div className="mt-1.5 max-w-md text-sm text-[--color-muted]">{description}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
