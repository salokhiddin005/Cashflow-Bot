"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { Send, X, Copy, Check, ExternalLink, Mic } from "lucide-react";

const BOT_USERNAME = (process.env.NEXT_PUBLIC_BOT_USERNAME ?? "").replace(/^@/, "");
const BOT_HANDLE = BOT_USERNAME ? `@${BOT_USERNAME}` : "@your_bot";
const BOT_URL = BOT_USERNAME ? `https://t.me/${BOT_USERNAME}` : "https://t.me/";

const EXAMPLES = [
  { lang: "Uzbek",   text: "1 200 000 sotuvdan, bugun" },
  { lang: "Russian", text: "потратил 350 000 на логистику вчера" },
  { lang: "English", text: "how much did we spend on rent this month?" },
];

export function TelegramHelpButton() {
  const [open, setOpen] = useState(false);

  // Lock background scroll while open + close on Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-2 rounded-md border border-[--color-border] bg-gradient-to-br from-indigo-500/10 via-[--color-surface] to-[--color-surface] px-3 py-1.5 text-[13px] font-medium shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-indigo-500/15 hover:border-indigo-500/40 focus-ring"
      >
        <Send className="h-3.5 w-3.5 text-indigo-500 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        Telegram bot
      </button>
      {open ? <Modal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function Modal({ onClose }: { onClose: () => void }) {
  // Portal: render at <body> so we escape any ancestor containing block
  // (the topbar uses `backdrop-blur`, which would otherwise pin our
  // `fixed inset-0` to the header instead of the viewport).
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-md sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Connect to Telegram bot"
    >
      <div
        // Window: distinct slate background, indigo accent border, drop shadow.
        className="my-auto w-full max-w-md overflow-hidden rounded-2xl border border-indigo-500/30 bg-slate-50 text-slate-900 shadow-[0_24px_70px_-15px_rgba(0,0,0,0.6)] ring-1 ring-black/5 dark:bg-slate-900 dark:text-slate-100 dark:ring-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Distinct colored header */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 px-6 py-5 text-white">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 text-[11.5px] font-medium text-white backdrop-blur hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
            Close
          </button>

          <div className="flex items-start gap-3 pr-16">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
              <Send className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[16px] font-semibold tracking-tight">Connect on Telegram</h2>
              <p className="mt-0.5 text-[12.5px] text-white/80">
                Scan the QR, copy the handle, or tap to open the bot.
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-[120px_1fr]">
          <div className="flex flex-col items-center gap-1.5">
            <div className="rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-200">
              <QRCodeSVG value={BOT_URL} size={104} level="M" />
            </div>
            <span className="text-[10.5px] text-slate-500 dark:text-slate-400">Scan with phone</span>
          </div>

          <div className="flex flex-col gap-2.5">
            <CopyableHandle handle={BOT_HANDLE} url={BOT_URL} />
            <a
              href={BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-slate-900"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Telegram
            </a>
          </div>
        </div>

        {/* Examples */}
        <div className="border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <span>Try saying or typing</span>
            <span className="inline-flex items-center gap-1 text-[10.5px] font-normal normal-case text-slate-400 dark:text-slate-500">
              <Mic className="h-3 w-3" /> voice works too
            </span>
          </div>
          <ul className="space-y-1.5">
            {EXAMPLES.map((ex) => (
              <li
                key={ex.lang}
                className="flex items-center gap-2 rounded-md bg-slate-100 px-2.5 py-1.5 dark:bg-slate-800/60"
              >
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600">
                  {ex.lang}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[12px]">&ldquo;{ex.text}&rdquo;</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer with prominent Close button */}
        <div className="flex items-center justify-end border-t border-slate-200 bg-slate-100/60 px-6 py-3 dark:border-slate-800 dark:bg-slate-800/40">
          <button
            onClick={onClose}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <X className="h-3.5 w-3.5" />
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CopyableHandle({ handle, url }: { handle: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable in non-secure contexts */
    }
  };
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-white px-2.5 py-1.5 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Bot handle</div>
        <div className="truncate font-mono text-[13px] font-semibold">{handle}</div>
      </div>
      <button
        onClick={onCopy}
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2 text-[11.5px] font-medium text-slate-700 hover:bg-white dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
