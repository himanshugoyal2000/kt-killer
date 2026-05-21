import { streamText, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { retrieveContext, formatContextForPrompt } from "@/lib/rag";

// The system prompt now instructs the model to use retrieved context.
// It also tells the model to cite its sources — this is how RAG answers
// become trustworthy (users can verify the source).
const SYSTEM_PROMPT = `You are KT-Killer, an AI-powered company knowledge assistant.
Your job is to help engineers find information, understand systems, and onboard faster.

Rules:
- Answer based on the provided context from the company knowledge base.
- If the context contains relevant information, use it and cite the source.
- If the context does not contain relevant information, say so clearly. Do not make up answers.
- When citing, use the format: (Source: Space > Document Title)
- Be concise and technical. Engineers don't need fluff.
- Format responses with markdown for readability.`;

function convertToModelMessages(
  uiMessages: UIMessage[]
): { role: "user" | "assistant"; content: string }[] {
  return uiMessages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.parts
      .filter(
        (part): part is { type: "text"; text: string } => part.type === "text"
      )
      .map((part) => part.text)
      .join(""),
  }));
}

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Get the user's org from their profile for org-scoped RAG search
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let contextBlock = "";

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (profile?.org_id) {
      const modelMessages = convertToModelMessages(messages);
      const lastUserMessage = modelMessages
        .filter((m) => m.role === "user")
        .pop();

      if (lastUserMessage) {
        try {
          const chunks = await retrieveContext(
            supabase,
            profile.org_id,
            lastUserMessage.content
          );
          contextBlock = formatContextForPrompt(chunks);
        } catch (error) {
          console.error("RAG retrieval error:", error);
        }
      }
    }
  }

  // Build the final system prompt: base instructions + retrieved context
  const fullSystemPrompt = contextBlock
    ? `${SYSTEM_PROMPT}\n\n${contextBlock}`
    : SYSTEM_PROMPT;

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: fullSystemPrompt,
    messages: convertToModelMessages(messages),
    temperature: 0.1,
  });

  return result.toUIMessageStreamResponse();
}
