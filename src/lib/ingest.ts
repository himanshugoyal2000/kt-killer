import { SupabaseClient } from "@supabase/supabase-js";
import { chunkDocument } from "./chunker";
import { embedTexts } from "./embeddings";

// The full ingestion pipeline for a single document:
// 1. Chunk the text into smaller pieces
// 2. Embed all chunks in one batch API call
// 3. Store the document metadata + chunks with embeddings in Supabase
//
// This is called from the upload API route.

interface IngestDocumentParams {
  supabase: SupabaseClient;
  orgId: string;
  spaceId: string;
  title: string;
  content: string;
  fileType?: string;
  uploadedBy: string;
}

export async function ingestDocument({
  supabase,
  orgId,
  spaceId,
  title,
  content,
  fileType = "markdown",
  uploadedBy,
}: IngestDocumentParams) {
  // Step 1: Chunk the document
  const chunks = chunkDocument(content);

  if (chunks.length === 0) {
    throw new Error("Document produced no chunks after splitting");
  }

  // Step 2: Embed all chunks in a single batch API call
  const chunkTexts = chunks.map((c) => c.content);
  const embeddings = await embedTexts(chunkTexts);

  // Step 3: Create the document record in Supabase
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      org_id: orgId,
      space_id: spaceId,
      title,
      file_type: fileType,
      uploaded_by: uploadedBy,
    })
    .select()
    .single();

  if (docError) throw docError;

  // Step 4: Insert all chunks with their embeddings
  const chunkRows = chunks.map((chunk, i) => ({
    document_id: doc.id,
    org_id: orgId,
    content: chunk.content,
    embedding: JSON.stringify(embeddings[i]),
    chunk_index: chunk.chunkIndex,
  }));

  const { error: chunkError } = await supabase
    .from("document_chunks")
    .insert(chunkRows);

  if (chunkError) throw chunkError;

  return {
    documentId: doc.id,
    chunksCreated: chunks.length,
  };
}
