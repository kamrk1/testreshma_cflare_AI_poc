// Pure acknowledgments/filler carry no question for retrieval to answer —
// running the full search+generation pipeline on "ok" or "thanks" just
// pulls a handful of loosely-matched pages and forces the model into its
// "can't find a direct answer" fallback, with irrelevant sources attached.
// This is an exact-match allowlist (not a length heuristic) so a genuine
// short question like "fees?" or "GST?" never gets swallowed by it.
const SMALL_TALK_PHRASES = new Set([
  "ok", "okay", "k", "kk", "okie", "oke",
  "thanks", "thank you", "thankyou", "thanks a lot", "many thanks",
  "cool", "great", "nice", "good", "perfect", "awesome", "alright", "sure", "fine",
  "got it", "gotit", "noted", "understood",
  "hi", "hello", "hey",
  "bye", "goodbye", "see you", "cya",
  // Hindi / Marathi (Devanagari)
  "ठीक है", "ठीक आहे", "धन्यवाद", "शुक्रिया", "आभारी आहे", "बरं", "छान", "ओके", "हो",
]);

export function isSmallTalk(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/[.!?]+$/g, "");
  return SMALL_TALK_PHRASES.has(normalized);
}

export const SMALL_TALK_REPLY =
  "You're welcome! Let me know if you have any other questions about our services.";
