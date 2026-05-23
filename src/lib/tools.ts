import { tool } from "ai";
import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { retrieveContext, formatContextForPrompt } from "./rag";

// Each tool is a function the LLM can decide to call.
// The AI SDK's `tool()` helper creates a typed tool definition with:
//   - description: tells the LLM WHEN to use this tool (critical for good routing)
//   - inputSchema: Zod schema the LLM must follow when calling (like a function signature)
//   - execute: our code that runs when the LLM invokes the tool
//
// In v6, `parameters` was renamed to `inputSchema`.

// Factory function — tools need the Supabase client and org_id at runtime,
// so we create them per-request rather than as static singletons.
export function createTools(supabase: SupabaseClient, orgId: string) {
  const searchKnowledgeBase = tool({
    description:
      "Search the company knowledge base for information about systems, " +
      "architecture, runbooks, processes, onboarding, or any company-specific topic. " +
      "Use this when the user asks a question that requires company knowledge to answer.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "The search query. Rephrase the user's question into a clear search query."
        ),
    }),
    execute: async ({ query }) => {
      const chunks = await retrieveContext(supabase, orgId, query);
      if (chunks.length === 0) {
        return "No relevant documents found in the knowledge base for this query.";
      }
      return formatContextForPrompt(chunks);
    },
  });

  const listDocuments = tool({
    description:
      "List all documents available in the company knowledge base. " +
      "Use this when the user asks what topics are available, what docs exist, " +
      "or wants to browse the knowledge base.",
    inputSchema: z.object({
      spaceName: z
        .string()
        .optional()
        .describe(
          "Optional: filter by space name (e.g. 'Engineering', 'HR & Policies')"
        ),
    }),
    execute: async ({ spaceName }) => {
      let query = supabase
        .from("documents")
        .select("title, file_type, created_at, spaces(name)")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (spaceName) {
        const { data: spaces } = await supabase
          .from("spaces")
          .select("id")
          .eq("org_id", orgId)
          .ilike("name", `%${spaceName}%`);

        if (spaces && spaces.length > 0) {
          query = query.in(
            "space_id",
            spaces.map((s) => s.id)
          );
        }
      }

      const { data: docs, error } = await query;
      if (error) return `Error fetching documents: ${error.message}`;
      if (!docs || docs.length === 0) return "No documents found.";

      const formatted = docs.map((d: any) => ({
        title: d.title,
        space: d.spaces?.name ?? "Unknown",
        type: d.file_type,
      }));

      return JSON.stringify(formatted, null, 2);
    },
  });

  const generateDiagram = tool({
    description:
      "Generate a Mermaid diagram (flowchart, sequence diagram, or architecture diagram). " +
      "Use this AFTER searching the knowledge base — first retrieve the relevant information, " +
      "then generate a diagram based on that information. " +
      "The diagram will be rendered visually in the chat.",
    inputSchema: z.object({
      title: z.string().describe("A short title for the diagram"),
      diagramType: z
        .enum(["flowchart", "sequenceDiagram", "classDiagram", "graph"])
        .describe("The type of Mermaid diagram to generate"),
      mermaidCode: z
        .string()
        .describe(
          "Valid Mermaid syntax for the diagram. Must start with the diagram type keyword."
        ),
    }),
    execute: async ({ title, diagramType, mermaidCode }) => {
      return JSON.stringify({ title, diagramType, mermaidCode });
    },
  });

  const summarizeDocuments = tool({
    description:
      "Retrieve content from multiple documents for cross-document summarization. " +
      "Use this when the user asks for an overview, comparison, or summary across " +
      "multiple topics or documents. Fetches broader content than a single search.",
    inputSchema: z.object({
      topic: z
        .string()
        .describe(
          "The topic or theme to gather documents about (e.g. 'all runbooks', 'architecture')"
        ),
      maxDocuments: z
        .number()
        .optional()
        .describe("Maximum number of documents to include (default 5)"),
    }),
    execute: async ({ topic, maxDocuments = 5 }) => {
      const chunks = await retrieveContext(
        supabase,
        orgId,
        topic,
        maxDocuments * 3,
        0.2
      );

      if (chunks.length === 0) {
        return "No documents found matching this topic.";
      }

      const byDocument = new Map<
        string,
        { title: string; space: string; contents: string[] }
      >();

      for (const chunk of chunks) {
        const existing = byDocument.get(chunk.documentId);
        if (existing) {
          existing.contents.push(chunk.content);
        } else {
          byDocument.set(chunk.documentId, {
            title: chunk.documentTitle,
            space: chunk.spaceName,
            contents: [chunk.content],
          });
        }
      }

      const sections = [...byDocument.values()]
        .slice(0, maxDocuments)
        .map(
          (doc) =>
            `## ${doc.space} > ${doc.title}\n\n${doc.contents.join("\n\n")}`
        );

      return `Documents found: ${byDocument.size}\n\n${sections.join("\n\n---\n\n")}`;
    },
  });

  return { searchKnowledgeBase, listDocuments, generateDiagram, summarizeDocuments };
}
