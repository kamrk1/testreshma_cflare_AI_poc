import type { RetrievedSource } from "./types";

export interface RetrievedChunk {
  text: string;
  source: RetrievedSource;
}

/**
 * Field mapping verified against @cloudflare/workers-types' AiSearchSearchResponse:
 * chunks: Array<{ id, type, score, text, item: { key, timestamp?, metadata? } }>.
 * `item.key` is the underlying item's storage key — for a web-crawler-sourced
 * instance this is the crawled page URL. If the crawler also stamps an
 * explicit URL into `item.metadata` (e.g. `metadata.url`), prefer that.
 */
export async function searchSite(instance: AiSearchInstance, query: string): Promise<RetrievedChunk[]> {
  const response = await instance.search({
    query,
    ai_search_options: {
      query_rewrite: { enabled: true },
      retrieval: { max_num_results: 5 },
    },
  });

  return response.chunks.map((chunk) => {
    const metadata = chunk.item.metadata ?? {};
    const url = (metadata.url as string) || (metadata.source_url as string) || chunk.item.key;
    const title = (metadata.title as string) || undefined;
    return {
      text: chunk.text,
      source: { url, title, score: chunk.score },
    };
  });
}

export function dedupeSources(chunks: RetrievedChunk[]): RetrievedSource[] {
  const seen = new Map<string, RetrievedSource>();
  for (const c of chunks) {
    if (!c.source.url || seen.has(c.source.url)) continue;
    seen.set(c.source.url, c.source);
  }
  return [...seen.values()];
}
