import { GoogleGenAI, type Part } from "@google/genai";

// gemini-2.5-flash-lite: multimodal (audio in), structured output, and the
// best free-tier headroom we have access to (15 RPM, 1,000 RPD). 2.0-flash
// turned out to be 0-limit on free tier; 2.5-flash is 10/250.
const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";

// Sleep helper.
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Read keys from env. Supports either:
//   GEMINI_API_KEY=AIza...,AIza...        (comma-separated)
//   GEMINI_API_KEY=AIza...                (single key, original behaviour)
function loadKeys(): string[] {
  const raw = process.env.GEMINI_API_KEY ?? "";
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

// Cache one client per key — creating GoogleGenAI does no network work,
// but we cache anyway so repeated calls hit the same instance.
const clients = new Map<string, GoogleGenAI>();
function clientFor(key: string): GoogleGenAI {
  let c = clients.get(key);
  if (!c) {
    c = new GoogleGenAI({ apiKey: key });
    clients.set(key, c);
  }
  return c;
}

// Round-robin cursor across the configured keys. Survives within a single
// process; a fresh serverless cold-start always starts at 0, but that's fine.
let cursor = 0;

function isRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|RESOURCE_EXHAUSTED|quota|rate/i.test(msg);
}

function retryDelayMs(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
  const secs = m ? parseFloat(m[1]) : 2;
  return Math.min(Math.ceil(secs * 1000), 8_000);
}

// Try the call across every available key. On a 429 we immediately try
// the next key (no sleep — different key = different quota). Only after
// every key has failed with 429 do we sleep and retry once on the
// rotating cursor. Non-429 errors propagate immediately.
async function callWithFallback<T>(fn: (c: GoogleGenAI) => Promise<T>): Promise<T> {
  const keys = loadKeys();
  if (keys.length === 0) throw new Error("GEMINI_API_KEY missing");

  let lastErr: unknown;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[(cursor + attempt) % keys.length];
    try {
      const result = await fn(clientFor(key));
      // Advance the cursor so the next call rotates evenly across keys.
      cursor = (cursor + attempt + 1) % keys.length;
      return result;
    } catch (e) {
      if (!isRateLimit(e)) throw e;
      lastErr = e;
      // try next key
    }
  }

  // All keys exhausted — back off briefly, then retry once on the next key.
  await sleep(retryDelayMs(lastErr));
  cursor = (cursor + 1) % keys.length;
  return fn(clientFor(keys[cursor]));
}

// Generate a structured JSON response. We request JSON mime type and pass the
// schema so Gemini constrains its output, then we still parse + Zod-validate
// downstream to be safe.
export async function generateJson<T = unknown>(args: {
  systemInstruction: string;
  userParts: Part[];
  responseSchema: object;
}): Promise<T> {
  const text = await callWithFallback(async (c) => {
    const resp = await c.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: args.userParts }],
      config: {
        systemInstruction: args.systemInstruction,
        responseMimeType: "application/json",
        responseSchema: args.responseSchema,
        temperature: 0.1,
      },
    });
    const t = resp.text;
    if (!t) throw new Error("Gemini returned empty text");
    return t;
  });
  return JSON.parse(text) as T;
}

// Generate plain text (used for transcription-only).
export async function generateText(args: {
  systemInstruction?: string;
  userParts: Part[];
}): Promise<string> {
  return callWithFallback(async (c) => {
    const resp = await c.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: args.userParts }],
      config: {
        systemInstruction: args.systemInstruction,
        temperature: 0,
      },
    });
    const t = resp.text;
    if (!t) throw new Error("Gemini returned empty text");
    return t;
  });
}
