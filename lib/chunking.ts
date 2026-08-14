// Word-based chunking (not exact tokens, but a close enough proxy without
// pulling in a tokenizer). ~250 words is comfortably inside embedding model
// limits and small enough for focused retrieval.
const WORDS_PER_CHUNK = 250;
const WORDS_OVERLAP = 40;

export interface TextChunk {
  index: number;
  text: string;
}

/**
 * Splits normalized text into overlapping word-count chunks. Overlap helps
 * avoid losing context that straddles a chunk boundary.
 */
export function chunkText(text: string): TextChunk[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const words = normalized.split(" ");
  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < words.length) {
    const end = Math.min(start + WORDS_PER_CHUNK, words.length);
    const chunkWords = words.slice(start, end);
    chunks.push({ index, text: chunkWords.join(" ") });
    index += 1;

    if (end === words.length) break;
    start = end - WORDS_OVERLAP;
  }

  return chunks;
}