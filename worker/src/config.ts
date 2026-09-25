import type { Env, SiteConfig } from "./types";

const CONFIG_KV_KEY = "site-config";

const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant for a Chartered Accountant firm's website.
Answer only using the "Retrieved site content" provided to you in this conversation.
If the retrieved content does not contain the answer, say plainly that you don't have
that information and offer the escalation contact — never invent prices, dates,
availability, or policies.
Always reply in the same language the user's latest message is written in
(English, Marathi, or Hindi). Keep answers short, clear, and easy to read on a phone.`;

export async function getSiteConfig(env: Env): Promise<SiteConfig> {
  const stored = await env.CONFIG.get<Partial<SiteConfig>>(CONFIG_KV_KEY, "json");
  return {
    botName: stored?.botName || env.BOT_NAME_FALLBACK,
    systemPrompt: stored?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    escalationContact: stored?.escalationContact || env.ESCALATION_CONTACT_FALLBACK,
    languages: stored?.languages?.length ? stored.languages : ["en", "mr", "hi"],
  };
}
