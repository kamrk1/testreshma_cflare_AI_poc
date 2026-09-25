# AI chat assistant (Cloudflare AI Search + Workers) — POC

Per-site AI chat widget backend, fully hosted on Cloudflare: **AI Search**
(retrieval over this site's own content), **Workers** (`/api/chat`, same
origin as the site), **AI Gateway** (all model calls, logged per site), and
**KV** (system prompt / bot config / lead capture fallback).

This POC deploys to a **`*.workers.dev`** domain (not `careshmajadhav.in`,
which stays on its current production host for now). The whole static site
in this repo is served by the same Worker via [Workers Static
Assets](https://developers.cloudflare.com/workers/static-assets/), so the
widget's calls to `/api/chat` are same-origin — no CORS. Moving to the real
domain later is a config change, not a rewrite (see "Moving to
`careshmajadhav.in` later" below).

## Architecture

```
careshmajadhav-chat.<your-subdomain>.workers.dev
├── /                    → static assets (this repo's existing HTML/CSS/JS/images)
├── /assets/js/ai-chat-widget.js  → new widget (dependency-free JS/CSS)
└── /api/chat  (POST)    → Worker: retrieval (AI Search) + generation (Workers AI via AI Gateway)
                             reads config from KV, writes captured leads to KV or CRM_WEBHOOK_URL
```

Per-site Cloudflare resources (all prefixed `careshmajadhav`, nothing shared
with any other site's stack):

| Resource | Name | Purpose |
|---|---|---|
| AI Search instance | `careshmajadhav-search` | Crawls & indexes the site, retrieval only |
| AI Gateway | `careshmajadhav-gw` | Every model call (embedding, generation) — logging & usage |
| KV namespace | (bound as `CONFIG`) | System prompt, bot name, escalation contact, captured leads |
| Worker | `careshmajadhav-chat` | `/api/chat`, same-origin, serves the site |

## One-time dashboard / CLI setup

You'll need to be logged in (`npx wrangler login`) with access to the
Cloudflare account this should deploy into.

1. **Install deps**: `npm install` (already done in this repo).

2. **Create the AI Gateway** (`careshmajadhav-gw`): Dashboard → AI Gateway →
   Create Gateway → name it `careshmajadhav-gw`. Leave logging on (default);
   this is what gives you per-site usage/cost visibility.

3. **Create the KV namespace**:
   ```
   npm run kv:create
   ```
   Copy the returned `id` into `wrangler.jsonc` → `env.careshmajadhav.kv_namespaces[0].id`
   (currently a `REPLACE_WITH_KV_NAMESPACE_ID` placeholder).

4. **Create the AI Search instance** (`careshmajadhav-search`), pointed at
   this site's crawled content:
   ```
   npx wrangler ai-search create careshmajadhav-search
   ```
   Follow the interactive prompts:
   - **Type**: `web-crawler`
   - **Source**: the URL to crawl — for this POC, once step 6 below is
     deployed, that's `https://careshmajadhav-chat.<your-subdomain>.workers.dev`
     (AI Search can only crawl a domain that exists in this same Cloudflare
     account — a `*.workers.dev` Worker qualifies since it's issued to your
     account; **this hasn't been verified against a real crawl yet, so treat
     it as the first thing to check once deployed** — if the crawler rejects
     a `workers.dev` source, the fallback is to upload this repo's HTML
     pages directly via `instance.items.upload()` / the dashboard "Upload
     files" flow instead of live crawling, which stays within "use AI
     Search's built-in ingestion", not a custom crawler)
   - **Embedding model**: `bge-m3` (multilingual — needed for English/Marathi/Hindi;
     this is fixed for the life of the instance)

   Then attach the gateway and pick the generation model (can be changed
   anytime, unlike the embedding model) — either in the dashboard on the
   instance's Settings page, or:
   ```
   npx wrangler ai-search update careshmajadhav-search \
     --ai-gateway-id careshmajadhav-gw \
     --ai-search-model "@cf/meta/llama-3.3-70b-instruct-fp8-fast" \
     --rewrite-query true \
     --cache false
   ```
   (`--cache false`: AI Search's own semantic result cache is separate from
   the "never cache multi-turn chat" requirement, which the Worker already
   enforces via `gateway.skipCache` on every generation call — but for a
   chat use case where near-duplicate phrasing across different users
   shouldn't reuse a cached answer, it's turned off here too. If your
   installed `wrangler` version doesn't yet expose these as flags, set them
   via the dashboard instance Settings page instead — same fields either way:
   `ai_gateway_id`, `ai_search_model`, `rewrite_query`, `cache`.)

5. **Set the embedding**: only choosable at creation (step 4) — if you need
   to change it later, you must create a new instance.

6. **First deploy** (creates the Worker + serves the static site):
   ```
   npm run deploy
   ```
   Note the `*.workers.dev` URL Wrangler prints — that's your `SITE_DOMAIN`
   for step 4's crawl source, and the URL to hand to the CA for review.

7. **Seed the system prompt / bot config into KV** (optional — sensible
   defaults are hardcoded as a fallback if you skip this):
   ```
   npm run seed:config
   ```
   Edit `worker/test/seed-config.mjs` first if you want to change the
   prompt/bot name before seeding.

8. **Secrets** (optional for this POC — see "Lead capture" below):
   ```
   npx wrangler secret put CRM_WEBHOOK_URL --env careshmajadhav
   ```

9. **Rate limiting**: the repo already enables Cloudflare's **Workers Rate
   Limiting binding** (`CHAT_RL` in `wrangler.jsonc`, 20 requests/60s per
   IP, free-plan-eligible, works without a zone) — no dashboard step needed
   for the POC. Once this moves onto `careshmajadhav.in` (a real zone), add
   a second, defense-in-depth layer: **Security → WAF → Rate limiting
   rules → Create rule**, match `URI Path equals /api/chat`, e.g. 30
   requests / 1 minute per IP, action "Block" or "Managed Challenge".

## Local dev

```
npm run dev
```

AI Search doesn't run locally — the binding is configured with
`remote: true` in `wrangler.jsonc`, so `wrangler dev` proxies AI Search
calls to the real, deployed instance (needs network + login). Everything
else (the Worker logic, KV, static assets) runs locally.

## Wire format (`POST /api/chat`)

Request:
```json
{ "message": "string, ≤2000 chars", "history": [{ "role": "user"|"assistant", "content": "..." }], "sessionId": "string" }
```
`history` is capped server-side to the last 6 turns regardless of what's sent.

Response is **either**:
- `Content-Type: application/json` — short deterministic replies (consent
  asks, lead confirmations, validation errors): `{ "reply": "...", "sources": [], "sessionId": "..." }`
- `Content-Type: text/plain` (chunked/streamed) — normal grounded answers:
  the body is the answer text streamed as it's generated; retrieved source
  links travel out-of-band in the `X-Chat-Sources` response header
  (`encodeURIComponent`-ed JSON array of `{ url, title?, score? }` — header
  values must be Latin1, so this survives non-ASCII Marathi/Hindi titles),
  since a plain-text stream can't carry structured data inline. The widget
  in `assets/js/ai-chat-widget.js` implements both branches.

Same-origin is enforced by comparing `Origin`/`Referer` against the
request's own `Host` header — not a hardcoded domain — so this works
unchanged on `*.workers.dev` today and on `careshmajadhav.in` later.

## Lead capture

Stateless by design (no server-side session store): on each turn the Worker
re-scans the *client-sent* `history` array for an Indian phone number
(`^(?:\+91|0)?[6-9]\d{9}$`, spaces/hyphen after `+91` tolerated) and for
booking/callback keywords. First time it sees a number, it replies with
exactly *"Can we contact you on this number?"* and nothing else; if the
very next user turn is affirmative (English/Hindi/Marathi yes-words), it
submits the lead — `{ siteSlug, sessionId, name, phone, messageSummary,
transcript, timestamp }` — to `CRM_WEBHOOK_URL` if set (POST JSON, follows
redirects — Google Apps Script Web Apps 302-redirect to the actual
response, so `redirect: "follow"` is required and already set), or to KV
(`lead:<timestamp>:<sessionId>`) if the webhook is unset or the POST fails,
so nothing is lost either way.

Name extraction is a best-effort regex ("my name is X" / "I am X" / "this
is X") — it's a POC heuristic, not NER; unmatched names are stored as "Not
provided" rather than blocking the lead.

You said the CRM webhook can be wired up later — until then, captured leads
just accumulate in KV under the `lead:` prefix; list them with:
```
npx wrangler kv key list --binding CONFIG --env careshmajadhav --remote --prefix lead:
```

## Switching between the old and new widget

`enquiry.html` (the only page currently loading the chat widget) has:
```html
<script>window.CA_CHAT_WIDGET = 'ai';</script>  <!-- 'ai' | 'oci' -->
```
Set it to `'oci'` to go back to the existing PocketAI/OCI widget
(`assets/js/chat-widget.js`, unchanged) — one line, no deploy of the Worker
needed (it's a static asset, so a redeploy just re-syncs the HTML). To add
the widget to other pages later, copy the same three `<script>` blocks
before `</body>`.

## Adding the next site

1. Copy this repo (or point Wrangler at the new site's own repo).
2. In `wrangler.jsonc`, copy the `env.careshmajadhav` block, rename the key
   and every resource name to the new `SITE_SLUG` (`<slug>-chat`,
   `<slug>-search`, `<slug>-gw`), and create a fresh KV namespace for it.
3. Repeat the dashboard/CLI setup steps above with the new slug.
4. `wrangler deploy --env <slug>`.
No Worker code changes — everything site-specific lives in the env block,
the KV config doc, and the AI Search instance.

## Moving to `careshmajadhav.in` later

1. Add `careshmajadhav.in` as a zone in this Cloudflare account (can stay
   DNS-only — the origin can keep being Netlify; only needed so AI Search
   can crawl it as an owned domain, and so the Worker route below can
   attach to it).
2. Point the AI Search instance's source at the real domain (or add it as
   an additional source, depending on what the dashboard allows at that
   point), and add a `routes` block to the `careshmajadhav` env:
   ```jsonc
   "routes": [{ "pattern": "careshmajadhav.in/api/chat*", "zone_name": "careshmajadhav.in" }]
   ```
3. Either deploy the actual site's assets through this same Worker (as the
   POC does), or — if the production site is staying on Netlify — keep only
   the `/api/chat*` route on Cloudflare and drop the `assets` block; you'll
   then need the Netlify-side CORS/relative-path setup instead of relying
   on same-origin, since the site and the API would be on different hosts
   again in that scenario.
4. Add the zone-level WAF rate limiting rule described above.

## Known gaps / things to verify once real resources exist

Cloudflare renamed AutoRAG → AI Search with a new binding API in 2026, and
this environment's egress policy blocks fetching `developers.cloudflare.com`
directly, so the binding contract here was verified two ways: web search
summaries, and — more reliably — reading the actual shipped TypeScript
definitions in `node_modules/@cloudflare/workers-types` (installed version
`5.20260925.1`) rather than trusting memory. That's a strong signal but not
a substitute for hitting the real instance. Specifically still open:

- **`item.metadata.url` for web-crawled chunks**: the response type
  (`AiSearchSearchResponse`) confirms each chunk carries `item.key` and an
  optional `item.metadata: Record<string, unknown>`, but doesn't pin down
  which metadata field (if any) holds the page URL for a `web-crawler`-type
  instance. `worker/src/retrieval.ts` tries `metadata.url` →
  `metadata.source_url` → falls back to `item.key` (which for a web crawl
  should itself be the page URL) — check a real response and adjust if the
  actual field name differs.
- **Whether AI Search can crawl a `*.workers.dev` source at all** — flagged
  above in setup step 4.
- **Exact `wrangler ai-search update` flag names** (`--ai-gateway-id` etc.)
  — confirmed the CLI subcommand and config fields (`ai_gateway_id`,
  `ai_search_model`, `rewrite_query`, `cache`) exist via the shipped types
  and changelog, but not each flag's exact CLI spelling; the dashboard
  Settings page is the fallback if a flag name doesn't match.
- Generation model id `@cf/meta/llama-3.3-70b-instruct-fp8-fast` — check the
  live Workers AI catalog for the exact current id/suffix before first
  deploy; swap it in `wrangler.jsonc` → `env.careshmajadhav.vars.GENERATION_MODEL`.

## Testing

`worker/test/questions.json` has 15 questions pulled from this site's own
content (`llms.txt` and the service pages) — 10 factual (5 English, 3
Marathi, 2 Hindi), 3 the site genuinely can't answer, and 2 multi-turn
lead-capture flows. After deploying:

```
CHAT_URL=https://careshmajadhav-chat.<your-subdomain>.workers.dev/api/chat npm run test:live
```

This hits every question against the live endpoint, measures latency, and
(re)writes `TEST_RESULTS.md` at the repo root with reply/sources/latency
per question plus the average — that file doesn't exist yet because it
needs a live deployment to produce real numbers rather than invented ones.
