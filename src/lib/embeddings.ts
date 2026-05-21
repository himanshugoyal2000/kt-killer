import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

// We use text-embedding-3-small — OpenAI's latest small embedding model.
// It outputs 1536-dimensional vectors.
// Cost: $0.02 per million tokens — extremely cheap.
// Quality: Good enough for most RAG use cases. The "large" variant is
// better but costs 6x more and the difference is marginal for our use case.
const embeddingModel = openai.embedding("text-embedding-3-small");

// Embed a single text string. Used at query time (embed the user's question).
export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  });
  return embedding;
}

// Embed multiple text strings in one API call. Used at ingestion time
// (embed all chunks of a document in a batch).
// OpenAI allows up to 2048 texts per batch.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: texts,
  });
  return embeddings;
}
