import { streamText, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";

const SYSTEM_PROMPT = `You are KT-Killer, an AI-powered company knowledge assistant.
Your job is to help engineers find information, understand systems, and onboard faster.

Rules:
- Be concise and technical. Engineers don't need fluff.
- If you don't know something, say so. Never make up information.
- When explaining, use examples and analogies.
- Format responses with markdown for readability.`;

// The useChat hook (v6) sends messages in UIMessage format: { role, parts: [...] }
// But streamText expects ModelMessage format: { role, content: string }
// This function converts between the two formats.
function convertToModelMessages(
  uiMessages: UIMessage[]
): { role: "user" | "assistant"; content: string }[] {
  return uiMessages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join(""),
  }));
}

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: SYSTEM_PROMPT,
    messages: convertToModelMessages(messages),
    temperature: 0.1,
  });

  return result.toUIMessageStreamResponse();
}
