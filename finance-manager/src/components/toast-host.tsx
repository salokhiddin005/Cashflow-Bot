"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Bot, AlertTriangle, Info, X } from "lucide-react";

type ToastVariant = "success" | "info" | "warning" | "bot";
type Toast = { id: number; title: string; description?: string; variant: ToastVariant; ttl: number };

type Ctx = {
  push: (t: Omit<Toast, "id" | "ttl"> & { ttl?: number }) => void;
};
const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastHost>");
  return ctx;
}

export function ToastHost({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);
  const router = useRouter();

  const push: Ctx["push"] = useCallback((t) => {
    const id = idRef.current++;
    const toast: Toast = { id, ttl: 4000, ...t };
    setToasts((cur) => [...cur, toast]);
    setTimeout(() => {
      setToasts((cur) => cur.filter((x) => x.id !== id));
    }, toast.ttl);
  }, []);

  // Subscribe to server-sent events. Whenever the server publishes a relevant
  // mutation, we (a) refresh the router so RSC pages re-fetch, and (b) raise
  // a toast — distinguishing bot-driven updates with a robot icon.
  useEffect(() => {
    let es: EventSource | null = null;
    let retries = 0;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      es = new EventSource("/api/events");
      es.addEventListener("transaction:created", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as { source: "web" | "telegram" };
          // Server Actions already revalidate their own pages on the same tab,
          // so we only refresh + toast for events from a *different* origin
          // (the bot, or another tab's mutation).
          if (data.source === "telegram") {
            push({
              title: "New transaction from the bot",
              description: "Dashboard refreshed automatically.",
              variant: "bot",
            });
            router.refresh();
          }
        } catch { /* ignore parse errors */ }
      });
      es.addEventListener("transaction:updated", () => router.refresh());
      es.addEventListener("transaction:deleted", () => router.refresh());
      es.addEventListener("category:changed", () => router.refresh());
      es.addEventListener("workspace:changed", () => router.refresh());

      es.onerror = () => {
        es?.close();
        es = null;
        // Exponential backoff up to 30s
        const delay = Math.min(30_000, 1_000 * 2 ** retries++);
        setTimeout(connect, delay);
      };
      es.onopen = () => { retries = 0; };
    };
    connect();
    return () => { cancelled = true; es?.close(); };
  }, [push, router]);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-[calc(100%-3rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => <ToastView key={t.id} toast={t} onClose={() => setToasts((c) => c.filter((x) => x.id !== t.id))} />)}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastView({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const Icon = ICON[toast.variant];
  return (
    <div
      className="pointer-events-auto flex items-start gap-3 rounded-xl border border-[--color-border] bg-[--color-surface] px-4 py-3 shadow-lg shadow-black/5 backdrop-blur"
      role="status"
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${TONE[toast.variant]}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium leading-5">{toast.title}</div>
        {toast.description ? (
          <div className="mt-0.5 text-[12px] text-[--color-muted]">{toast.description}</div>
        ) : null}
      </div>
      <button
        onClick={onClose}
        className="rounded-md p-0.5 text-[--color-muted] hover:bg-[--color-surface-2] hover:text-[--color-foreground]"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const ICON: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  info:    Info,
  warning: AlertTriangle,
  bot:     Bot,
};
const TONE: Record<ToastVariant, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  info:    "text-indigo-600 dark:text-indigo-400",
  warning: "text-amber-600 dark:text-amber-400",
  bot:     "text-indigo-600 dark:text-indigo-400",
};
