import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { createTools } from "@/lib/tools";
import { getMcpTools } from "@/lib/mcp-manager";

// Phase 4 system prompt: the LLM now has BOTH internal tools AND external MCP tools.
// It doesn't need to know which tools come from where — it just sees a flat list
// and picks the best tool for each question.
const SYSTEM_PROMPT = `You are KT-Killer, an AI-powered company knowledge assistant.
Your job is to help engineers find information, understand systems, and onboard faster.

You have access to tools that let you:
- Search the company knowledge base for technical docs, runbooks, and processes
- List and summarize documents across the knowledge base
- Generate diagrams from retrieved information
- Look up employees, find team members by skill/department, and view the org chart
- Search open source project documentation via DeepWiki (for any GitHub repository)

Rules:
- For company-specific questions, ALWAYS use the searchKnowledgeBase tool first.
- For people questions (who works on X, who is Y, org chart), use the team directory tools.
- For open source library/framework questions, use the DeepWiki tools to look up the repo docs.
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

  // Phase 4: merge internal tools (our knowledge base) with MCP tools (external servers).
  // The LLM sees one flat tool list — it doesn't know or care which tools are "ours"
  // vs which come from external MCP servers. This is the power of the protocol.
  let internalTools: Record<string, any> = {};

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (profile?.org_id) {
      internalTools = createTools(supabase, profile.org_id);
    }
  }

  let mcpTools: Record<string, any> = {};
  try {
    mcpTools = await getMcpTools();
  } catch (error) {
    console.error("[MCP] Failed to get MCP tools:", error);
  }

  const allTools = { ...internalTools, ...mcpTools };

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: allTools,
    stopWhen: stepCountIs(5),
    temperature: 0.1,
  });

  return result.toUIMessageStreamResponse();
}
