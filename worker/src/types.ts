// AiSearchInstance and RateLimit come from @cloudflare/workers-types (global
// ambient types) — verified directly against the installed package's
// index.d.ts rather than assumed from docs. AiSearchInstance is the type of
// a single-instance `ai_search` binding (as opposed to AiSearchNamespace,
// which is what `ai_search_namespaces` binds).
export interface Env {
  AI: Ai;
  AI_SEARCH: AiSearchInstance;
  CONFIG: KVNamespace;
  CHAT_RL: RateLimit;

  SITE_SLUG: string;
  SITE_DOMAIN: string;
  GATEWAY_ID: string;
  GENERATION_MODEL: string;
  BOT_NAME_FALLBACK: string;
  ESCALATION_CONTACT_FALLBACK: string;

  // Secrets — set via `wrangler secret put`, never committed.
  CRM_WEBHOOK_URL?: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequestBody {
  message: string;
  history?: ChatTurn[];
  sessionId: string;
  lang?: string;
}

export interface SiteConfig {
  botName: string;
  systemPrompt: string;
  escalationContact: string;
  languages: string[];
}

export interface RetrievedSource {
  url: string;
  title?: string;
  score?: number;
}

export interface CapturedLead {
  siteSlug: string;
  sessionId: string;
  name: string;
  phone: string;
  messageSummary: string;
  transcript: ChatTurn[];
  timestamp: string;
}
