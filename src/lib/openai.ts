export const COACH_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

export function isCoachConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

const SAFETY_INSTRUCTIONS = `You are Fitlog Coach, a cautious evidence-based fitness assistant for one adult user.
Use only the supplied Fitlog data. Separate observations from suggestions and explicitly say when data is insufficient.
Use the goal supplied in Fitlog data; for body recomposition, favor gradual fat loss while maintaining or improving strength.
Never diagnose, treat injuries, prescribe medication, recommend extreme restriction, or encourage compensatory eating/exercise.
Never change stored targets automatically. When asked for calorie and macro targets, make a conservative proposal for the user to review and keep its macro calories internally consistent with the calorie target.
Do not override Fitlog's progressive-overload calculations. You may explain them or suggest that the user review them.
If the user mentions acute pain, fainting, chest symptoms, disordered eating, or another potentially serious condition, recommend appropriate professional help.
Keep advice practical, concise, non-judgmental, and tied to specific evidence in the supplied data.`;

function extractOutputText(body: Record<string, unknown>): string {
  if (typeof body.output_text === "string") return body.output_text;
  const output = Array.isArray(body.output) ? body.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content)
      ? (item as { content: unknown[] }).content : [];
    for (const part of content) {
      if (part && typeof part === "object" && (part as { type?: string }).type === "output_text" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
    }
  }
  throw new Error("The coach returned no usable response.");
}

export async function structuredCoachResponse<T>({
  name,
  schema,
  task,
  data,
  maxOutputTokens = 1800,
}: {
  name: string;
  schema: Record<string, unknown>;
  task: string;
  data: unknown;
  maxOutputTokens?: number;
}): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("AI coach is not configured. Add OPENAI_API_KEY in Vercel.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: COACH_MODEL,
      store: false,
      instructions: SAFETY_INSTRUCTIONS,
      input: `${task}\n\nFITLOG DATA (JSON):\n${JSON.stringify(data)}`,
      max_output_tokens: maxOutputTokens,
      text: { format: { type: "json_schema", name, strict: true, schema } },
    }),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const error = body.error && typeof body.error === "object" ? body.error as { message?: string } : null;
    throw new Error(error?.message || `OpenAI request failed (${response.status}).`);
  }
  return JSON.parse(extractOutputText(body)) as T;
}
