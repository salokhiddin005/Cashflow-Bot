import { generateText } from "./llm";

// Telegram voice messages are .oga (Opus). Gemini accepts audio inline as base64
// up to ~20MB which is far more than any voice note will ever be.
export async function transcribeAudio(buffer: Buffer, mimeType = "audio/ogg"): Promise<string> {
  const base64 = buffer.toString("base64");
  const text = await generateText({
    systemInstruction:
      "You are a transcription engine. The audio is a short voice note from a small-business owner in Uzbekistan, in Uzbek (Latin or Cyrillic), Russian, or English. Transcribe it verbatim. Output ONLY the transcript text — no quotes, no language label, no commentary.",
    userParts: [
      { inlineData: { mimeType, data: base64 } },
      { text: "Transcribe the audio." },
    ],
  });
  return text.trim();
}
