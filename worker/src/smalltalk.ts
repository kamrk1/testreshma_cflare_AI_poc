// Pure acknowledgments/greetings/farewells carry no question for retrieval
// to answer — running the full search+generation pipeline on them just
// pulls a handful of loosely-matched pages and forces the model into its
// "can't find a direct answer" fallback, with irrelevant sources attached.
// Each is an exact-match allowlist (not a length heuristic) so a genuine
// short question like "fees?" or "GST?" never gets swallowed by it.

const GREETINGS = new Set(["hi", "hello", "hey", "hola", "namaste", "नमस्कार", "नमस्ते"]);

const THANKS = new Set([
  "thanks", "thank you", "thankyou", "thanks a lot", "many thanks",
  "धन्यवाद", "शुक्रिया", "आभारी आहे",
]);

const FAREWELLS = new Set(["bye", "goodbye", "see you", "cya", "byee"]);

const GENERIC_ACK = new Set([
  "ok", "okay", "k", "kk", "okie", "oke",
  "cool", "great", "nice", "good", "perfect", "awesome", "alright", "sure", "fine",
  "got it", "gotit", "noted", "understood",
  "ठीक है", "ठीक आहे", "बरं", "छान", "ओके", "हो",
]);

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[.!?]+$/g, "");
}

/**
 * Returns the canned reply for a pure small-talk message, or null if the
 * message isn't small talk (and should go through normal retrieval).
 */
export function matchSmallTalk(text: string, botName: string, escalationContact: string): string | null {
  const normalized = normalize(text);

  if (GREETINGS.has(normalized)) {
    return `Hello! I'm ${botName}. You can ask me about our services, office timings, fees, GST, or ITR filing.`;
  }
  if (THANKS.has(normalized)) {
    return "You're welcome! Let me know if you have any other questions.";
  }
  if (FAREWELLS.has(normalized)) {
    return `Thank you for chatting with us! Feel free to reach out anytime — ${escalationContact}.`;
  }
  if (GENERIC_ACK.has(normalized)) {
    return "Sure! Let me know if there's anything else I can help with.";
  }
  return null;
}
