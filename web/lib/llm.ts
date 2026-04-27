import OpenAI from "openai";

export const DEFAULT_MODEL = "gpt-5";
export const DEFAULT_BASE_URL = "https://api.openai.com/v1";

function getClient(apiKey: string, baseURL?: string): OpenAI {
  if (!apiKey) throw new Error("Missing API key");
  return new OpenAI({
    apiKey,
    baseURL: baseURL?.trim() || DEFAULT_BASE_URL,
    dangerouslyAllowBrowser: true,
  });
}

export type StreamHandlers = {
  onText: (text: string) => void;
  onDone: (full: string) => void;
  onError: (err: Error) => void;
};

export async function streamMessage(
  config: { apiKey: string; baseURL?: string; model?: string },
  opts: {
    system: string;
    messages: { role: "user" | "assistant"; content: string }[];
  },
  handlers: StreamHandlers,
) {
  const client = getClient(config.apiKey, config.baseURL);
  let full = "";
  try {
    const stream = await client.chat.completions.create({
      model: config.model || DEFAULT_MODEL,
      stream: true,
      messages: [
        { role: "system", content: opts.system },
        ...opts.messages,
      ],
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        full += delta;
        handlers.onText(delta);
      }
    }
    handlers.onDone(full);
  } catch (err) {
    handlers.onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export async function transcribeAudio(
  config: { apiKey: string; baseURL?: string },
  blob: Blob,
  filename = "recording.webm",
): Promise<string> {
  const client = getClient(config.apiKey, config.baseURL);
  const file = new File([blob], filename, { type: blob.type || "audio/webm" });
  const res = await client.audio.transcriptions.create({
    file,
    model: "whisper-1",
  });
  return res.text;
}

export async function oneShot(
  config: { apiKey: string; baseURL?: string; model?: string },
  opts: { system: string; user: string },
): Promise<string> {
  const client = getClient(config.apiKey, config.baseURL);
  const res = await client.chat.completions.create({
    model: config.model || DEFAULT_MODEL,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  });
  return res.choices[0]?.message?.content ?? "";
}
