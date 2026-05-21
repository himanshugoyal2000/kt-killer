// Recursive markdown text splitter.
//
// The strategy:
// 1. Try to split by ## headings (sections) — keeps logical units together
// 2. If a section is too big, split by paragraphs (double newlines)
// 3. If a paragraph is too big, split by sentences
// 4. If a sentence is too big, split by character count (last resort)
//
// Each chunk includes overlap with the previous chunk to handle
// answers that span chunk boundaries.

export interface Chunk {
  content: string;
  chunkIndex: number;
}

interface ChunkerOptions {
  maxChunkSize: number; // max characters per chunk (not tokens — rough approx)
  chunkOverlap: number; // overlap characters between consecutive chunks
}

const DEFAULT_OPTIONS: ChunkerOptions = {
  maxChunkSize: 1500, // ~375 tokens. Sweet spot for embedding quality.
  chunkOverlap: 200, // ~50 tokens overlap. Helps with boundary answers.
};

// The separators to try, in order of preference.
// We want the biggest logical unit that fits within maxChunkSize.
const MARKDOWN_SEPARATORS = [
  "\n## ", // H2 headings (main sections)
  "\n### ", // H3 headings (subsections)
  "\n#### ", // H4 headings
  "\n\n", // Paragraphs
  "\n", // Lines
  ". ", // Sentences
  " ", // Words (last resort)
];

export function chunkDocument(
  text: string,
  options: Partial<ChunkerOptions> = {}
): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const rawChunks = recursiveSplit(text, MARKDOWN_SEPARATORS, opts);

  // Add overlap between chunks.
  // Each chunk gets the last N characters of the previous chunk prepended.
  const chunksWithOverlap: string[] = [];
  for (let i = 0; i < rawChunks.length; i++) {
    if (i === 0) {
      chunksWithOverlap.push(rawChunks[i]);
    } else {
      const previousText = rawChunks[i - 1];
      const overlap = previousText.slice(-opts.chunkOverlap);
      chunksWithOverlap.push(overlap + rawChunks[i]);
    }
  }

  return chunksWithOverlap
    .map((content, index) => ({
      content: content.trim(),
      chunkIndex: index,
    }))
    .filter((chunk) => chunk.content.length > 0);
}

function recursiveSplit(
  text: string,
  separators: string[],
  opts: ChunkerOptions
): string[] {
  if (text.length <= opts.maxChunkSize) {
    return [text];
  }

  // Try each separator in order until we find one that exists in the text
  for (let i = 0; i < separators.length; i++) {
    const separator = separators[i];
    const parts = splitKeepingSeparator(text, separator);

    if (parts.length <= 1) continue;

    // Merge small adjacent parts into chunks up to maxChunkSize.
    // This prevents creating tiny chunks when sections are short.
    const merged = mergeParts(parts, opts.maxChunkSize);

    // Recursively split any merged chunk that's still too big,
    // using the next separator in the list.
    const result: string[] = [];
    for (const chunk of merged) {
      if (chunk.length <= opts.maxChunkSize) {
        result.push(chunk);
      } else {
        result.push(...recursiveSplit(chunk, separators.slice(i + 1), opts));
      }
    }

    return result;
  }

  // If no separator worked (extremely long word), hard-split by character count
  const result: string[] = [];
  for (let i = 0; i < text.length; i += opts.maxChunkSize) {
    result.push(text.slice(i, i + opts.maxChunkSize));
  }
  return result;
}

// Splits text by a separator but keeps the separator attached to the part after it.
// "Hello## World## Foo" → ["Hello", "## World", "## Foo"]
// This preserves headings with their content.
function splitKeepingSeparator(text: string, separator: string): string[] {
  const parts = text.split(separator);
  if (parts.length <= 1) return parts;

  const result: string[] = [parts[0]];
  for (let i = 1; i < parts.length; i++) {
    result.push(separator + parts[i]);
  }
  return result.filter((p) => p.length > 0);
}

// Merges consecutive small parts until they would exceed maxSize.
// ["short1", "short2", "long_section", "short3"] →
// ["short1\nshort2", "long_section", "short3"]
function mergeParts(parts: string[], maxSize: number): string[] {
  const merged: string[] = [];
  let current = "";

  for (const part of parts) {
    if (current.length + part.length <= maxSize) {
      current += part;
    } else {
      if (current) merged.push(current);
      current = part;
    }
  }

  if (current) merged.push(current);
  return merged;
}
