import { SupabaseClient } from "@supabase/supabase-js";
import { embedText } from "./embeddings";

// A single retrieved chunk with its source document info.
export interface RetrievedChunk {
  content: string;
  documentId: string;
  documentTitle: string;
  spaceName: string;
  similarity: number;
}

// The RAG retrieval function.
// 1. Embeds the user's question
// 2. Calls the match_document_chunks Postgres function via Supabase RPC
// 3. Enriches results with document titles and space names
// 4. Returns the top-K most relevant chunks
export async function retrieveContext(
  supabase: SupabaseClient,
  orgId: string,
  query: string,
  topK: number = 5,
  threshold: number = 0.3
): Promise<RetrievedChunk[]> {
  // Step 1: Embed the question
  const queryEmbedding = await embedText(query);

  // Step 2: Call the Postgres function for vector similarity search.
  // Pass embedding as JSON string — pgvector expects '[0.1, 0.2, ...]' format.
  // Threshold of 0.3 is appropriate for text-embedding-3-small with cosine similarity;
  // typical relevant matches score 0.4–0.7, so 0.3 filters out noise without
  // being so aggressive that we miss good matches (0.7 was too high).
  const { data: chunks, error } = await supabase.rpc(
    "match_document_chunks",
    {
      query_embedding: JSON.stringify(queryEmbedding),
      match_org_id: orgId,
      match_count: topK,
      match_threshold: threshold,
    }
  );

  if (error) throw error;
  if (!chunks || chunks.length === 0) return [];

  // Step 3: Get document titles and space names for citations
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

  // Step 4: Combine chunks with their document info
  return chunks.map((chunk: any) => {
    const doc = docMap.get(chunk.document_id) ?? {
      title: "Unknown",
      spaceName: "Unknown",
    };
    return {
      content: chunk.content,
      documentId: chunk.document_id,
      documentTitle: doc.title,
      spaceName: doc.spaceName,
      similarity: chunk.similarity,
    };
  });
}

// Formats retrieved chunks into a string that gets injected into the LLM prompt.
export function formatContextForPrompt(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  const contextParts = chunks.map(
    (chunk, i) =>
      `[Source ${i + 1}: ${chunk.spaceName} > ${chunk.documentTitle}]\n${chunk.content}`
  );

  return `--- RETRIEVED CONTEXT FROM COMPANY KNOWLEDGE BASE ---\n\n${contextParts.join("\n\n---\n\n")}\n\n--- END CONTEXT ---`;
}
