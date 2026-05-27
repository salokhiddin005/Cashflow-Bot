// Tiny in-process pub/sub for live dashboard updates.
// Server Actions and the bot handler call publish() after mutations; the
// SSE route at /api/events forwards events to all subscribed browser tabs.

export type EventName =
  | "transaction:created"
  | "transaction:updated"
  | "transaction:deleted"
  | "category:changed"
  | "workspace:changed";

export type AppEvent = {
  name: EventName;
  source: "web" | "telegram";
  payload?: Record<string, unknown>;
  ts: number;
};

type Listener = (e: AppEvent) => void;

declare global {
  // eslint-disable-next-line no-var
  var __fmListeners: Set<Listener> | undefined;
}

function bus(): Set<Listener> {
  if (!globalThis.__fmListeners) globalThis.__fmListeners = new Set();
  return globalThis.__fmListeners;
}

export function publish(name: EventName, opts: { source?: AppEvent["source"]; payload?: AppEvent["payload"] } = {}) {
  const evt: AppEvent = {
    name,
    source: opts.source ?? "web",
    payload: opts.payload,
    ts: Date.now(),
  };
  for (const l of bus()) {
    try { l(evt); } catch { /* a slow subscriber must not break others */ }
  }
}

export function subscribe(listener: Listener): () => void {
  bus().add(listener);
  return () => { bus().delete(listener); };
}
