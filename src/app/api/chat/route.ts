import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { createTools } from "@/lib/tools";

// Phase 3 system prompt: the LLM is now an AGENT with tools.
// Instead of "here's context, answer from it" (Phase 2),
// we tell the model "you have tools — decide which ones to use."
const SYSTEM_PROMPT = `You are KT-Killer, an AI-powered company knowledge assistant.
Your job is to help engineers find information, understand systems, and onboard faster.

You have access to tools that let you search the knowledge base, list documents,
generate diagrams, and summarize across multiple documents.

Rules:
- For company-specific questions, ALWAYS use the searchKnowledgeBase tool first.
- When citing information, use the format: (Source: Space > Document Title)
- If no relevant information is found, say so clearly. Do not make up answers.
- For diagram requests, first search for relevant info, then generate the diagram.
- For overview/summary requests, use the summarizeDocuments tool.
- For casual greetings or general questions, respond directly without tools.
- Be concise and technical. Engineers don't need fluff.
- Format responses with markdown for readability.`;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let tools = {};

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (profile?.org_id) {
      tools = createTools(supabase, profile.org_id);
    }
  }

  // streamText with tools + stopWhen creates the AGENT LOOP:
  //
  //   1. LLM sees the user message + tool descriptions
  //   2. LLM decides: answer directly OR call a tool
  //   3. If tool called → our execute() runs → result sent back to LLM
  //   4. LLM sees the tool result → decides: answer now OR call another tool
  //   5. Repeat until LLM gives a final text response or step limit is hit
  //
  // stepCountIs(5) = LLM can chain up to 5 tool calls per user message.
  // This replaced maxSteps in AI SDK v6.
  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
    temperature: 0.1,
  });

  return result.toUIMessageStreamResponse();
}
