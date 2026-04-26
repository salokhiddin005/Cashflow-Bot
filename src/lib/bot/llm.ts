import { GoogleGenAI, type Part } from "@google/genai";

// gemini-2.5-flash-lite: multimodal (audio in), structured output, and the
// best free-tier headroom we have access to (15 RPM, 1,000 RPD). 2.0-flash
// turned out to be 0-limit on free tier; 2.5-flash is 10/250.
const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";

let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!_client) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
    _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return _client;
}

// Sleep helper.
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Extract the API's suggested retry delay (in seconds) from a 429 error message.
// Falls back to 2s if not present. Capped at 8s so the bot doesn't hang.
function retryDelayMs(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
  const secs = m ? parseFloat(m[1]) : 2;
  return Math.min(Math.ceil(secs * 1000), 8_000);
}

function isRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|RESOURCE_EXHAUSTED|quota|rate/i.test(msg);
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!isRateLimit(e)) throw e;
    await sleep(retryDelayMs(e));
    return await fn();
  }
}

// Generate a structured JSON response. We request JSON mime type and pass the
// schema so Gemini constrains its output, then we still parse + Zod-validate
// downstream to be safe.
export async function generateJson<T = unknown>(args: {
  systemInstruction: string;
  userParts: Part[];
  responseSchema: object;
}): Promise<T> {
  const text = await withRetry(async () => {
    const resp = await client().models.generateContent({
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
  return withRetry(async () => {
    const resp = await client().models.generateContent({
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
