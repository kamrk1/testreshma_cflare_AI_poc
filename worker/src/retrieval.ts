import type { RetrievedSource } from "./types";

export interface RetrievedChunk {
  text: string;
  source: RetrievedSource;
}

// Any data source (an upload folder, a repo mirror) can end up with non-page
// assets alongside real content. If one gets indexed, it must not leak into
// either the generation context or the displayed source list — a JS/CSS
// file matched for an unrelated question is a sign of a noisy index, not a
// real source.
const NON_CONTENT_EXTENSIONS = /\.(js|css|json|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf)$/i;

/**
 * Field mapping verified against @cloudflare/workers-types' AiSearchSearchResponse:
 * chunks: Array<{ id, type, score, text, item: { key, timestamp?, metadata? } }>.
 * `item.key` is the underlying item's storage key — for a web-crawler-sourced
 * instance this is the crawled page URL; for a manually-uploaded data source
 * (no live crawl) it's just the uploaded file's storage path, not a real URL —
 * links built from it won't resolve to real site pages in that case. If the
 * crawler also stamps an explicit URL into `item.metadata` (e.g.
 * `metadata.url`), prefer that.
 */
export async function searchSite(instance: AiSearchInstance, query: string): Promise<RetrievedChunk[]> {
  const response = await instance.search({
    query,
    ai_search_options: {
      query_rewrite: { enabled: true },
      retrieval: { max_num_results: 5 },
    },
  });

  return response.chunks
    .filter((chunk) => !NON_CONTENT_EXTENSIONS.test(chunk.item.key))
    .map((chunk) => {
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
