import type { ChatTurn, SiteConfig } from "./types";
import type { RetrievedChunk } from "./retrieval";

export function buildMessages(
  siteConfig: SiteConfig,
  chunks: RetrievedChunk[],
  history: ChatTurn[],
  message: string
) {
  const retrievedBlock = chunks.length
    ? chunks
        .map((c, i) => `[${i + 1}] (${c.source.url || "unknown source"})\n${c.text}`)
        .join("\n\n")
    : "(No matching content was found on the site for this question.)";

  const system = [
    siteConfig.systemPrompt,
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
