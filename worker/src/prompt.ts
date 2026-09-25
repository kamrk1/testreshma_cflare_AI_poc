import type { ChatTurn, SiteConfig } from "./types";
import type { RetrievedChunk } from "./retrieval";

// The business operates in India — "today"/"tomorrow"/"is it open now"
// questions must be answered relative to India Standard Time, not the
// Worker's UTC clock (a request at 11pm IST is already the next day UTC).
const BUSINESS_TIMEZONE = "Asia/Kolkata";

function currentDateTimeLine(now: Date): string {
  const formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);
  return `Current date and time (India Standard Time): ${formatted}. Use this to answer any question about "today", "tomorrow", "this week", office hours right now, or due dates — never say you don't know the current date.`;
}

export function buildMessages(
  siteConfig: SiteConfig,
  chunks: RetrievedChunk[],
  history: ChatTurn[],
  message: string,
  now: Date = new Date()
) {
  const retrievedBlock = chunks.length
    ? chunks
        .map((c, i) => `[${i + 1}] (${c.source.url || "unknown source"})\n${c.text}`)
        .join("\n\n")
    : "(No matching content was found on the site for this question.)";

  const system = [
    siteConfig.systemPrompt,
    "",
    currentDateTimeLine(now),
    "",
    `Escalation contact if you cannot answer from the retrieved content: ${siteConfig.escalationContact}`,
    "",
    "Retrieved site content:",
    retrievedBlock,
  ].join("\n");

  return [
    { role: "system", content: system },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];
}
