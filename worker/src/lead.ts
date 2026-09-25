import type { CapturedLead, ChatTurn, Env } from "./types";

// Indian mobile numbers: 10 digits starting 6-9, optional +91 / 91 / 0 prefix,
// optional spaces or a hyphen after the country code.
const INDIA_PHONE_RE = /(?:\+?91[\s-]?|0)?([6-9]\d{9})\b/;

const AFFIRMATIVE_WORDS = [
  "yes", "yeah", "yep", "sure", "ok", "okay", "please", "go ahead",
  "haan", "han", "ha", "theek hai", "thik ahe", "chalel", "chalega",
  "हाँ", "हां", "जी हाँ", "ठीक है",
  "हो", "होय", "ठीक आहे", "चालेल",
];

export const CONSENT_QUESTION = "Can we contact you on this number?";

const BOOKING_KEYWORDS = [
  "book", "booking", "callback", "call back", "call me", "appointment",
  "consultation", "meeting", "contact me",
];

export function extractPhone(text: string): string | null {
  const match = text.match(INDIA_PHONE_RE);
  return match ? match[1] : null;
}

export function findPhoneInThread(message: string, history: ChatTurn[]): string | null {
  const fromMessage = extractPhone(message);
  if (fromMessage) return fromMessage;
  for (let i = history.length - 1; i >= 0; i--) {
    const found = extractPhone(history[i].content);
    if (found) return found;
  }
  return null;
}

export function looksLikeBookingRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return BOOKING_KEYWORDS.some((kw) => lower.includes(kw));
}

export function isAffirmative(text: string): boolean {
  const lower = text.trim().toLowerCase();
  // Only ever called after we've just asked the consent question, so a
  // short "yes"/"haan"/"होय"-style reply is expected — match whole tokens
  // (split on non-letter chars) rather than raw substring, so e.g. "smoke"
  // can't false-match "ok".
  const tokens = lower.split(/[^\p{L}]+/u).filter(Boolean);
  return AFFIRMATIVE_WORDS.some((w) => {
    const wl = w.toLowerCase();
    return wl.includes(" ") ? lower.includes(wl) : tokens.includes(wl);
  });
}

export function consentAlreadyAsked(history: ChatTurn[]): boolean {
  const lastAssistant = [...history].reverse().find((t) => t.role === "assistant");
  return !!lastAssistant && lastAssistant.content.includes(CONSENT_QUESTION);
}

/** Best-effort name guess: "my name is X", "I am X", or a capitalised
 * 1-3 word run. Falls back to "Not provided" — this is a POC heuristic,
 * not a real NER model. */
const NAME_STOPWORDS = new Set(["and", "my", "phone", "number", "is", "at", "from", "please", "to"]);

export function guessName(message: string, history: ChatTurn[]): string {
  const patterns = [
    /my name is ([a-zA-Z\s]{2,40})/i,
    /i'?m ([a-zA-Z\s]{2,40})/i,
    /i am ([a-zA-Z\s]{2,40})/i,
    /this is ([a-zA-Z\s]{2,40})/i,
  ];
  const haystack = [message, ...history.map((h) => h.content)].join("\n");
  for (const p of patterns) {
    const m = haystack.match(p);
    if (!m) continue;
    const words: string[] = [];
    for (const w of m[1].trim().split(/\s+/)) {
      if (NAME_STOPWORDS.has(w.toLowerCase()) || words.length >= 3) break;
      words.push(w);
    }
    if (words.length) return words.join(" ");
  }
  return "Not provided";
}

export function buildTranscriptSummary(message: string, history: ChatTurn[]): string {
  const recent = history.slice(-3).map((h) => `${h.role}: ${h.content}`).join(" | ");
  return recent ? `${recent} | user: ${message}` : `user: ${message}`;
}

export async function submitLead(env: Env, lead: CapturedLead): Promise<{ delivered: boolean; via: "webhook" | "kv" }> {
  if (env.CRM_WEBHOOK_URL) {
    try {
      const res = await fetch(env.CRM_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(lead),
        redirect: "follow",
      });
      if (res.ok) return { delivered: true, via: "webhook" };
    } catch {
      // fall through to KV fallback below
    }
  }

  await env.CONFIG.put(`lead:${lead.timestamp}:${lead.sessionId}`, JSON.stringify(lead));
  return { delivered: true, via: "kv" };
}
