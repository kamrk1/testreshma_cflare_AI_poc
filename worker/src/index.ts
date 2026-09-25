import type { ChatTurn, Env } from "./types";
import { clampHistory, isSameOrigin, isValidChatBody } from "./security";
import { getSiteConfig } from "./config";
import { searchSite, dedupeSources } from "./retrieval";
import { buildMessages } from "./prompt";
import {
  CONSENT_QUESTION,
  buildTranscriptSummary,
  consentAlreadyAsked,
  findPhoneInThread,
  guessName,
  isAffirmative,
  looksLikeBookingRequest,
  submitLead,
} from "./lead";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== "/api/chat") {
      return new Response("Not found", { status: 404 });
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
    }
    if (!isSameOrigin(request)) {
      return json({ error: "Cross-origin requests are not allowed." }, 403);
    }

    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const { success } = await env.CHAT_RL.limit({ key: ip });
    if (!success) {
      return json({ error: "Too many requests. Please try again in a minute." }, 429);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }
    if (!isValidChatBody(body)) {
      return json({ error: "Invalid request. 'message' and 'sessionId' are required." }, 400);
    }

    const message = body.message.trim();
    const history = clampHistory(body.history as ChatTurn[] | undefined);
    const sessionId = body.sessionId;

    const siteConfig = await getSiteConfig(env);

    // ── Lead-capture flow (stateless: state lives in the client-sent history) ──

    // Turn N+1: we already asked "Can we contact you on this number?" and the
    // user just replied affirmatively -> submit the lead.
    if (consentAlreadyAsked(history) && isAffirmative(message)) {
      const phone = findPhoneInThread(message, history);
      if (phone) {
        const name = guessName(message, history);
        const result = await submitLead(env, {
          siteSlug: env.SITE_SLUG,
          sessionId,
          name,
          phone,
          messageSummary: buildTranscriptSummary(message, history),
          transcript: [...history, { role: "user", content: message }],
          timestamp: new Date().toISOString(),
        });
        const reply =
          result.via === "webhook"
            ? "Thank you! We've noted your details and our team will contact you shortly."
            : "Thank you! We've saved your details and our team will reach out shortly.";
        return json({ reply, sources: [], sessionId, leadCaptured: true });
      }
    }

    // Turn N: a phone number or booking request just showed up and we
    // haven't asked for consent yet this thread -> ask, don't answer yet.
    const phoneInThread = findPhoneInThread(message, history);
    if (!consentAlreadyAsked(history) && (phoneInThread || looksLikeBookingRequest(message))) {
      if (phoneInThread) {
        return json({ reply: CONSENT_QUESTION, sources: [], sessionId });
      }
      // Booking intent but no phone number yet — ask for it first.
      return json({
        reply: "Sure — could you share your name and phone number so our team can reach out?",
        sources: [],
        sessionId,
      });
    }

    // ── Normal grounded Q&A flow ──
    try {
      const chunks = await searchSite(env.AI_SEARCH, message);
      const sources = dedupeSources(chunks);
      const messages = buildMessages(siteConfig, chunks, history, message);

      // env.GENERATION_MODEL is a plain `string` (from wrangler vars), not a
      // literal keyof AiModelList, so this resolves to the SDK's "unknown
      // model" overload — which is why the result needs an explicit
      // ReadableStream cast even though `stream: true` guarantees one at
      // runtime. `gateway.skipCache` is confirmed in the installed
      // @cloudflare/workers-types (GatewayOptions) — required so multi-turn
      // chat is never served from the AI Gateway cache.
      const aiResponse = (await env.AI.run(
        env.GENERATION_MODEL,
        { messages, stream: true },
        { gateway: { id: env.GATEWAY_ID, skipCache: true } }
      )) as unknown as ReadableStream;

      // Re-emit only the text deltas from the model's own SSE stream as a
      // plain chunked text/plain body, so the widget doesn't need an SSE
      // parser. Sources travel out-of-band in a response header.
      const plainTextStream = toPlainTextStream(aiResponse);

      return new Response(plainTextStream, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "x-chat-session-id": sessionId,
          // HTTP header values must be Latin1 — encode in case a crawled
          // page title contains non-ASCII (Marathi/Hindi) characters.
          "x-chat-sources": encodeURIComponent(JSON.stringify(sources)),
        },
      });
    } catch (err) {
      // Surface the real cause (visible in `wrangler tail` / dashboard Logs
      // either way) in the JSON response too, so failures are diagnosable
      // from the browser network tab without needing log access — this is
      // a POC, not exposing anything secret, just AI Search/Workers AI/AI
      // Gateway error text (e.g. "gateway not found", "instance not found").
      console.error("chat generation failed", err);
      const detail = err instanceof Error ? err.message : String(err);
      return json(
        {
          error: `Something went wrong generating an answer. Please contact us: ${siteConfig.escalationContact}`,
          detail,
          sessionId,
        },
        502
      );
    }
  },
};

function toPlainTextStream(aiStream: ReadableStream): ReadableStream {
  const reader = aiStream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffered = "";

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload) as { response?: string };
          if (parsed.response) controller.enqueue(encoder.encode(parsed.response));
        } catch {
          // Non-JSON keepalive line from the stream — ignore.
        }
      }
    },
  });
}
