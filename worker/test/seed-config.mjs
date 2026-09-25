#!/usr/bin/env node
/**
 * Seeds the KV "site-config" key that the Worker reads for bot name,
 * system prompt, and escalation contact (see worker/src/config.ts).
 * Optional — the Worker falls back to sensible defaults if this key is
 * never set, but you'll usually want to customize the system prompt.
 *
 * Usage: npm run seed:config
 */
import { execFileSync } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";

const config = {
  botName: "CA Reshma AI Assistant",
  escalationContact: "WhatsApp +91 81779 22977 (careshmajadhav@gmail.com)",
  languages: ["en", "mr", "hi"],
  systemPrompt: `You are the AI assistant for CA Reshma Jadhav & Company, a Chartered
Accountant firm in Satara, Maharashtra. Answer only using the "Retrieved site
content" provided to you in this conversation — business ITR filing, GST,
accounting/bookkeeping, startup & company registration, loan project reports,
and business advisory.
If the retrieved content does not contain the answer, say plainly that you
don't have that information and offer the escalation contact — never invent
prices, dates, availability, or policies.
Always reply in the same language the user's latest message is written in
(English, Marathi, or Hindi). Keep answers short, clear, and easy to read on
a phone.
State your conclusion directly and immediately — never narrate your reasoning
steps out loud (for example, if asked whether the office is open tomorrow,
answer "Yes, we're open tomorrow (Saturday), 10 AM-7 PM" directly; do not
first explain "today is Friday, so tomorrow is Saturday" before answering).`,
};

const tmpPath = path.join(process.cwd(), ".site-config.tmp.json");

async function main() {
  await writeFile(tmpPath, JSON.stringify(config, null, 2), "utf8");
  try {
    execFileSync(
      "npx",
      ["wrangler", "kv", "key", "put", "site-config", "--path", tmpPath, "--binding", "CONFIG", "--env", "careshmajadhav", "--remote"],
      { stdio: "inherit" }
    );
    console.log("Seeded KV key 'site-config'.");
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

main();
