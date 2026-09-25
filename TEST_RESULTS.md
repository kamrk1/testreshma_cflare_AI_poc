# Test results — pending live deployment

This file is a placeholder. It's generated (overwritten) by:

```
CHAT_URL=https://careshmajadhav-chat.<your-subdomain>.workers.dev/api/chat npm run test:live
```

which runs the 15 questions in `worker/test/questions.json` (5 English, 3
Marathi, 2 Hindi, 3 unanswerable, 2 lead-capture flows — see
`README-ai-chat.md` → Testing) against the real endpoint and records reply,
sources, and latency for each, plus the average latency.

Real numbers require the AI Search instance, AI Gateway, KV, and Worker to
actually exist per the setup steps in `README-ai-chat.md` — there is no
deployment yet, so no latency/quality numbers can be reported honestly.
Once you run it, this file will contain the results table plus a short
assessment of answer quality (especially Marathi) and latency, and any
recommended model change, per the original ask.
