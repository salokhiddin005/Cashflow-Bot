"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** Visual tone — "danger" uses the rose gradient, "primary" uses indigo. */
  variant?: "danger" | "primary";
};

type Resolver = (result: boolean) => void;

const ConfirmCtx = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const fn = useContext(ConfirmCtx);
  if (!fn) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return fn;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolver: Resolver } | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolver) => setState({ opts, resolver }));
  }, []);

  const close = useCallback((result: boolean) => {
    setState((cur) => {
      cur?.resolver(result);
      return null;
    });
  }, []);

  // Keyboard: Esc cancels, Enter confirms — only while dialog is open.
  // Also locks page scroll so the backdrop can't jiggle.
  useEffect(() => {
    if (!state) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        close(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [state, close]);

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && typeof document !== "undefined"
        ? createPortal(
            <Dialog
              opts={state.opts}
              onConfirm={() => close(true)}
              onCancel={() => close(false)}
            />,
            document.body,
          )
        : null}
    </ConfirmCtx.Provider>
  );
}

function Dialog({
  opts,
  onConfirm,
  onCancel,
}: {
  opts: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const variant = opts.variant ?? "danger";
  const confirmText = opts.confirmText ?? (variant === "danger" ? "Delete" : "Confirm");
  const cancelText = opts.cancelText ?? "Cancel";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-[--color-border] bg-[--color-surface] shadow-[0_24px_70px_-15px_rgba(0,0,0,0.5)] ring-1 ring-black/5 dark:ring-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              variant === "danger"
                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 pr-2">
            <h2 id="confirm-title" className="text-[15px] font-semibold tracking-tight">
              {opts.title}
            </h2>
            {opts.description ? (
              <p className="mt-1 text-[13px] text-[--color-muted]">{opts.description}</p>
            ) : null}
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="rounded-md p-1 text-[--color-muted] hover:bg-[--color-surface-2] hover:text-[--color-foreground]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Footer / actions */}
        <div className="mt-5 flex items-center justify-end gap-2 border-t border-[--color-border] bg-[--color-surface-2]/40 px-5 py-3">
          <button
            onClick={onCancel}
            className="inline-flex h-9 items-center justify-center rounded-md border border-[--color-border] bg-[--color-surface] px-3.5 text-[13px] font-medium text-[--color-foreground] shadow-sm transition-all duration-150 hover:bg-[--color-surface-2] hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className={`group inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-4 text-[13px] font-medium text-white transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 ${
              variant === "danger"
                ? "bg-gradient-to-br from-rose-600 to-red-600 shadow-[0_4px_14px_-4px_rgba(244,63,94,0.45)] hover:from-rose-500 hover:to-red-500 hover:shadow-[0_8px_22px_-6px_rgba(244,63,94,0.55)] focus-visible:ring-rose-400"
                : "bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.45)] hover:from-indigo-500 hover:to-violet-500 hover:shadow-[0_8px_22px_-6px_rgba(99,102,241,0.55)] focus-visible:ring-indigo-400"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
