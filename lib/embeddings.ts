import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";

// Loading the model is slow (downloads weights on first use, then keeps them
// on disk). Cache the pipeline on `global` the same way lib/db.ts caches the
// Mongo client, so Next.js dev hot-reloads don't reload it on every request.
declare global {
  // eslint-disable-next-line no-var
  var _embeddingExtractorPromise: Promise<FeatureExtractionPipeline> | undefined;
}

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!global._embeddingExtractorPromise) {
    global._embeddingExtractorPromise = pipeline(
      "feature-extraction",
      MODEL_NAME
    ) as Promise<FeatureExtractionPipeline>;
  }
  return global._embeddingExtractorPromise;
}

/**
 * Embeds a single piece of text into a 384-dim normalized vector.
 * Because the vector is L2-normalized, dot product == cosine similarity.
 */
export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}