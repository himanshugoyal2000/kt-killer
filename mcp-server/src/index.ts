// KT-Killer MCP Server
//
// This is a standalone process that exposes our knowledge base over the MCP protocol.
// Any MCP client (Cursor, Claude Desktop, other AI apps) can connect to this server
// and search our company knowledge base — without going through the web UI.
//
// Transport: stdio (local process communication)
// The MCP client spawns this process and communicates via stdin/stdout using JSON-RPC.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

// --- Configuration ---
// The MCP server uses the service role key because it runs as a trusted backend process,
// not as a user-facing app. It needs to bypass RLS to access all org data.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ORG_ID = process.env.MCP_ORG_ID ?? "00000000-0000-0000-0000-000000000001";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const embeddingModel = openai.embedding("text-embedding-3-small");

// --- Helper functions (same logic as src/lib/rag.ts and src/lib/embeddings.ts) ---

async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: embeddingModel, value: text });
  return embedding;
}

async function searchKnowledge(query: string, topK = 5, threshold = 0.3) {
  const queryEmbedding = await embedText(query);

  const { data: chunks, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_org_id: ORG_ID,
    match_count: topK,
    match_threshold: threshold,
  });

  if (error) throw error;
  if (!chunks || chunks.length === 0) return [];

  const documentIds = [...new Set(chunks.map((c: any) => c.document_id))];
  const { data: documents } = await supabase
    .from("documents")
    .select("id, title, spaces(name)")
    .in("id", documentIds);

  const docMap = new Map(
    (documents ?? []).map((d: any) => [
      d.id,
      { title: d.title, spaceName: d.spaces?.name ?? "Unknown" },
    ])
  );

  return chunks.map((chunk: any) => {
    const doc = docMap.get(chunk.document_id) ?? { title: "Unknown", spaceName: "Unknown" };
    return {
      content: chunk.content,
      documentTitle: doc.title,
      spaceName: doc.spaceName,
      similarity: chunk.similarity,
    };
  });
}

// --- MCP Server Setup ---

const server = new McpServer({
  name: "kt-killer",
  version: "1.0.0",
});

// Tool 1: Search the knowledge base
server.tool(
  "searchKnowledgeBase",
  "Search the company knowledge base for information about systems, architecture, runbooks, processes, onboarding, or any company-specific topic.",
  { query: z.string().describe("The search query") },
  async ({ query }) => {
    try {
      const results = await searchKnowledge(query);
      if (results.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No relevant documents found." }],
        };
      }

      const formatted = results
        .map(
          (r: any, i: number) =>
            `[Source ${i + 1}: ${r.spaceName} > ${r.documentTitle} (similarity: ${r.similarity.toFixed(3)})]\n${r.content}`
        )
        .join("\n\n---\n\n");

      return {
        content: [{ type: "text" as const, text: formatted }],
      };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Search error: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool 2: List all documents in the knowledge base
server.tool(
  "listDocuments",
  "List all documents available in the company knowledge base. Use this to see what topics are covered.",
  {
    spaceName: z.string().optional().describe("Optional: filter by space name"),
  },
  async ({ spaceName }) => {
    try {
      let query = supabase
        .from("documents")
        .select("title, file_type, created_at, spaces(name)")
        .eq("org_id", ORG_ID)
        .order("created_at", { ascending: false });

      if (spaceName) {
        const { data: spaces } = await supabase
          .from("spaces")
          .select("id")
          .eq("org_id", ORG_ID)
          .ilike("name", `%${spaceName}%`);

        if (spaces && spaces.length > 0) {
          query = query.in("space_id", spaces.map((s) => s.id));
        }
      }

      const { data: docs, error } = await query;
      if (error) throw error;
      if (!docs || docs.length === 0) {
        return { content: [{ type: "text" as const, text: "No documents found." }] };
      }

      const formatted = docs
        .map((d: any) => `- ${d.spaces?.name ?? "Unknown"} > ${d.title} (${d.file_type})`)
        .join("\n");

      return {
        content: [{ type: "text" as const, text: `Documents in knowledge base:\n\n${formatted}` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error listing documents: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool 3: Get a summary of documents on a topic
server.tool(
  "summarizeDocuments",
  "Retrieve and summarize content from multiple documents on a given topic. Use for overviews and cross-document summaries.",
  {
    topic: z.string().describe("The topic to gather documents about"),
    maxDocuments: z.number().optional().describe("Maximum documents to include (default 5)"),
  },
  async ({ topic, maxDocuments = 5 }) => {
    try {
      const results = await searchKnowledge(topic, maxDocuments * 3, 0.2);
      if (results.length === 0) {
        return { content: [{ type: "text" as const, text: "No documents found for this topic." }] };
      }

      const byDocument = new Map<string, { title: string; space: string; contents: string[] }>();
      for (const r of results) {
        const key = r.documentTitle;
        const existing = byDocument.get(key);
        if (existing) {
          existing.contents.push(r.content);
        } else {
          byDocument.set(key, { title: r.documentTitle, space: r.spaceName, contents: [r.content] });
        }
      }

      const sections = [...byDocument.values()]
        .slice(0, maxDocuments)
        .map((doc) => `## ${doc.space} > ${doc.title}\n\n${doc.contents.join("\n\n")}`)
        .join("\n\n---\n\n");

      return {
        content: [{ type: "text" as const, text: `Documents found: ${byDocument.size}\n\n${sections}` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error summarizing: ${error}` }],
        isError: true,
      };
    }
  }
);

// --- Start the server ---
// Uses stdio transport: the MCP client spawns this process and talks via stdin/stdout.
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCP Server failed to start:", error);
  process.exit(1);
});
