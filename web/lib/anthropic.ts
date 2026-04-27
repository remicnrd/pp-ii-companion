import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_MODEL = "claude-sonnet-4-6";

export function getClient(apiKey: string): Anthropic {
  if (!apiKey) throw new Error("Missing Anthropic API key");
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
}

export type StreamHandlers = {
  onText: (text: string) => void;
  onDone: (full: string) => void;
  onError: (err: Error) => void;
};

export async function streamMessage(
  apiKey: string,
  opts: {
    system: string;
    messages: { role: "user" | "assistant"; content: string }[];
    model?: string;
    maxTokens?: number;
  },
  handlers: StreamHandlers,
) {
  const client = getClient(apiKey);
  let full = "";
  try {
    const stream = await client.messages.stream({
      model: opts.model ?? DEFAULT_MODEL,
      max_tokens: opts.maxTokens ?? 4096,
      system: opts.system,
      messages: opts.messages,
    });
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        full += event.delta.text;
        handlers.onText(event.delta.text);
      }
    }
    handlers.onDone(full);
  } catch (err) {
    handlers.onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export async function oneShot(
  apiKey: string,
  opts: {
    system: string;
    user: string;
    model?: string;
    maxTokens?: number;
  },
): Promise<string> {
  const client = getClient(apiKey);
  const res = await client.messages.create({
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  const block = res.content[0];
  if (block.type !== "text") return "";
  return block.text;
}
