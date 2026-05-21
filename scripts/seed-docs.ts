// Seed script: uploads all NovaMart docs to the knowledge base.
// Run with: npx tsx scripts/seed-docs.ts
//
// This reads all markdown files from docs/novamart/,
// calls the ingestion pipeline for each one,
// and stores them in the Engineering space.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { chunkDocument } from "../src/lib/chunker";
import { embedTexts } from "../src/lib/embeddings";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ORG_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "12cfee0d-6935-4585-b5a1-a1e69902c3e1";

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(
      "Missing env vars. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
    );
    console.error(
      "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (find it in Supabase Dashboard → Settings → API → service_role)"
    );
    process.exit(1);
  }

  // Use the service role key to bypass RLS for seeding
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Get the Engineering space
  const { data: spaces } = await supabase
    .from("spaces")
    .select("id, name")
    .eq("org_id", ORG_ID);

  const engineeringSpace = spaces?.find((s) => s.name === "Engineering");
  if (!engineeringSpace) {
    console.error("Engineering space not found. Run the seed SQL first.");
    process.exit(1);
  }

  const docsDir = join(process.cwd(), "docs", "novamart");
  const files = readdirSync(docsDir).filter((f) => f.endsWith(".md"));

  console.log(`Found ${files.length} documents to ingest.\n`);

  for (const file of files) {
    const filePath = join(docsDir, file);
    const content = readFileSync(filePath, "utf-8");
    const title = file.replace(".md", "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    console.log(`Processing: ${title}`);

    // Step 1: Chunk
    const chunks = chunkDocument(content);
    console.log(`  Chunks: ${chunks.length}`);

    // Step 2: Embed
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await embedTexts(chunkTexts);
    console.log(`  Embeddings: ${embeddings.length}`);

    // Step 3: Create document record
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .insert({
        org_id: ORG_ID,
        space_id: engineeringSpace.id,
        title,
        file_type: "markdown",
        uploaded_by: USER_ID,
      })
      .select()
      .single();

    if (docError) {
      console.error(`  Error creating document: ${docError.message}`);
      continue;
    }

    // Step 4: Insert chunks with embeddings
    const chunkRows = chunks.map((chunk, i) => ({
      document_id: doc.id,
      org_id: ORG_ID,
      content: chunk.content,
      embedding: JSON.stringify(embeddings[i]),
      chunk_index: chunk.chunkIndex,
    }));

    const { error: chunkError } = await supabase
      .from("document_chunks")
      .insert(chunkRows);

    if (chunkError) {
      console.error(`  Error inserting chunks: ${chunkError.message}`);
      continue;
    }

    console.log(`  ✓ Done\n`);
  }

  console.log("All documents ingested successfully!");
}

main().catch(console.error);
