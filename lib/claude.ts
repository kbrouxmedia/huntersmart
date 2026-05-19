import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function runAgent(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from Claude");
  return extractJson(block.text);
}

function extractJson(text: string): string {
  // Strip markdown code blocks (```json ... ``` or ``` ... ```)
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();

  // Try to extract raw JSON array or object directly
  const arr = text.match(/(\[[\s\S]*\])/);
  if (arr) return arr[1].trim();

  const obj = text.match(/(\{[\s\S]*\})/);
  if (obj) return obj[1].trim();

  return text.trim();
}
