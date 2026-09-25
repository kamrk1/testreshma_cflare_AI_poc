import type { Env } from "./types";

// Devanagari block covers both Hindi and Marathi.
const DEVANAGARI_RE = /[ऀ-ॿ]/;

// Romanized Marathi/Hindi ("Address kay ahe", "GST kaise hota hai") is
// extremely common on Indian mobile keyboards and carries no non-Latin
// script for DEVANAGARI_RE to catch. This is a curated allowlist of common
// function/question words in each language's Roman transliteration —
// imperfect (it's not a language-ID model), but it catches the pattern
// that actually showed up in testing without flagging genuine English.
const ROMANIZED_INDIC_WORDS = new Set([
  // Marathi
  "kay", "ahe", "aahe", "tumcha", "tumchi", "tumche", "tumhi", "kuthe", "kiti",
  "karta", "karte", "kartat", "kasa", "kashi", "kasla", "kon", "konta",
  "mahiti", "pahije", "milel", "lokeshan", "sanga", "denar",
  // Hindi
  "kya", "hai", "kaise", "kaha", "kahan", "kitna", "kitne", "aap", "kripya",
  "karo", "hain", "kyun", "kaun", "chahiye", "batao", "bataye", "mujhe", "humein",
]);

function looksRomanizedIndic(text: string): boolean {
  const tokens = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return tokens.some((t) => ROMANIZED_INDIC_WORDS.has(t));
}

export function looksNonEnglish(text: string): boolean {
  return DEVANAGARI_RE.test(text) || looksRomanizedIndic(text);
}

/**
 * The indexed site content is entirely in English, and cross-lingual
 * embedding match quality (Marathi/Hindi query -> English documents) is the
 * weakest link in this pipeline — a short, colloquial, mixed-script query
 * like "Gst ची कामे करता काय" can fail to retrieve content that plainly
 * exists (e.g. gst-services-satara.html), even with a multilingual
 * embedding model. Translating to English before retrieval sidesteps that
 * entirely, since it's then an English-to-English match — the strongest
 * case for any embedding model. The final answer is still generated from
 * the *original* message, so the reply-in-the-user's-language instruction
 * in the system prompt is unaffected.
 */
export async function translateToEnglish(env: Env, text: string): Promise<string> {
  try {
    // Routed through the same AI Gateway as every other model call, per the
    // architecture's "all model calls through one gateway" requirement.
    // Unlike the main answer generation, this is safe to cache (identical
    // input text translates identically), so skipCache is intentionally
    // omitted here.
    const result = (await env.AI.run(
      env.GENERATION_MODEL,
      {
        messages: [
          {
            role: "system",
            content:
              "Translate the user's message to English for use as a search query. Output ONLY the English translation, nothing else — no quotes, no explanation.",
          },
          { role: "user", content: text },
        ],
      },
      { gateway: { id: env.GATEWAY_ID } }
    )) as Record<string, unknown>;

    const translated = typeof result.response === "string" ? result.response.trim() : "";
    return translated || text;
  } catch (err) {
    console.error("translateToEnglish failed, falling back to original text", err);
    return text;
  }
}

export async function getSearchQuery(env: Env, message: string): Promise<string> {
  return looksNonEnglish(message) ? translateToEnglish(env, message) : message;
}
