import Anthropic from "@anthropic-ai/sdk"

/**
 * LLM content drafting (server-only). Credential-gated by ANTHROPIC_API_KEY —
 * draftPageContent throws a clear error until it's set. Uses Claude Opus 4.8
 * with adaptive thinking; the system prompt carries a cache breakpoint so
 * repeated drafts across pages reuse it.
 */

export function isLlmConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

const SYSTEM_PROMPT = `You are an expert SEO copywriter for automotive dealerships.
You write people-first web page content that is genuinely useful to car shoppers
and service customers, not keyword-stuffed filler.

Rules:
- Write for the specific dealership, model, and local market given.
- Honor the page's "guardrail" — it states what the page must do for the user.
- Use clear, natural language. No clichés, no fabricated claims, no fake reviews,
  no invented pricing or inventory.
- Produce a usable first draft: an H1, a short intro, 2-4 scannable sections with
  H2s, and a clear call to action. Keep it concise.
- Output clean Markdown only — no preamble, no "Here is..." framing.`

/**
 * @param {object} input
 * @param {string} input.dealerName
 * @param {string} input.pageLabel    reconstructed page name (e.g. "K5 in PMA East Hartford")
 * @param {string} [input.model]
 * @param {string} [input.pmaCity]
 * @param {string} [input.intent]     template page_intent
 * @param {string} [input.requiredInputs]
 * @param {string} [input.guardrail]
 * @param {string} [input.factSheet]  short dealer fact-sheet markdown for grounding
 * @returns {Promise<string>} markdown draft
 */
export async function draftPageContent(input) {
  if (!isLlmConfigured()) {
    throw new Error("ANTHROPIC_API_KEY isn't set — AI drafting is disabled.")
  }
  const client = new Anthropic()

  const userText = [
    `Draft the SEO content for this dealer page.`,
    ``,
    `Dealer: ${input.dealerName}`,
    `Page: ${input.pageLabel}`,
    input.model ? `Model: ${input.model}` : null,
    input.pmaCity ? `Local market (PMA): ${input.pmaCity}` : null,
    ``,
    input.intent ? `Page intent: ${input.intent}` : null,
    input.requiredInputs ? `Required inputs: ${input.requiredInputs}` : null,
    input.guardrail ? `People-first guardrail: ${input.guardrail}` : null,
    ``,
    input.factSheet ? `Dealer fact sheet for grounding:\n${input.factSheet}` : null,
  ]
    .filter((l) => l !== null)
    .join("\n")

  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userText }],
  })

  return res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim()
}
