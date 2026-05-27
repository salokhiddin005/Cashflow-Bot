import { subscribe } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-Sent Events stream. The dashboard subscribes to this once on mount;
// every mutation (Server Action or bot webhook) publishes to the in-process
// event bus, and we forward each event as a single SSE message.
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try { controller.enqueue(encoder.encode(data)); } catch { /* closed */ }
      };

      // Initial comment + a "connected" event so EventSource fires onopen.
      send(`: connected\n\n`);
      send(`event: hello\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);

      unsubscribe = subscribe((e) => {
        send(`event: ${e.name}\ndata: ${JSON.stringify(e)}\n\n`);
      });

      // Keep-alive comment every 25s so proxies don't close the connection.
      heartbeat = setInterval(() => send(`: ping\n\n`), 25_000);

      // Tear down when the client disconnects.
      request.signal.addEventListener("abort", () => {
        if (unsubscribe) unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      if (unsubscribe) unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
