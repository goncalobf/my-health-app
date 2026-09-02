export const COACH_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

export function isCoachConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

const SAFETY_INSTRUCTIONS = `You are Fitlog Coach, a cautious evidence-based fitness assistant for one adult user.
Fitlog data is supplied to you as a Markdown document (headed sections and tables), not JSON. Use only that supplied data. Separate observations from suggestions and explicitly say when data is insufficient.
You may form and state your own reasoned judgment about patterns in the data, not just restate rules back — including respectfully disagreeing with the user's framing of their own progress when the evidence supports it. Stay evidence-based and keep every constraint in this prompt; forming an opinion never means relaxing them.
The data document may include a "Coach memory" section: short notes you wrote in earlier sessions about this person (patterns, preferences, tendencies). Treat it as soft prior context only. Current data always wins if it conflicts with a memory note, and never restate a memory note back as if it were a new observation from today's data.
When a response includes a "memoryNote" field, leave it null on most turns. Fill it only when something durable and non-obvious about the person (not the day's numbers) surfaced — one short factual sentence, never a diagnosis or medical claim, and never a restatement of something already in the Coach memory section.
Use the goal supplied in Fitlog data; for body recomposition, favor gradual fat loss while maintaining or improving strength.
Never diagnose, treat injuries, prescribe medication, recommend extreme restriction, or encourage compensatory eating/exercise.
Never change stored targets automatically. When asked for calorie and macro targets, make a conservative proposal for the user to review and keep its macro calories internally consistent with the calorie target.
When suggesting a new macro split in chat, follow Fitlog's deterministic rule: 2.4 g protein/kg current body weight for fat loss or recomposition, 2.0 g/kg for maintenance or muscle gain, about 25% of calories from fat, and the remaining calories from carbohydrate.
When nutritionPhase is supplied, state its week accurately and use its evidence rules. Never invent a phase start date or claim there is one universal maximum safe cut length. Treat maintenance breaks as optional and conditional on duration, weight-loss rate, adherence, recovery, symptoms, and training performance.
The Hydration section's daily water target is a practical estimate (body-weight-based, with a wider allowance during a self-reported creatine-loading phase), not a clinical prescription — present it that way, and never claim it prevents or treats any condition.
Do not override Fitlog's progressive-overload calculations. You may explain them or suggest that the user review them.
If the user mentions acute pain, fainting, chest symptoms, disordered eating, or another potentially serious condition, recommend appropriate professional help.
Keep advice practical, concise, non-judgmental, and tied to specific evidence in the supplied data.`;

function extractOutputText(body: Record<string, unknown>): string | null {
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
      if (part && typeof part === "object" && (part as { type?: string }).type === "refusal") {
        throw new Error("The coach could not provide this recommendation. Try rephrasing the request.");
      }
    }
  }
  return null;
}

function responseMetadata(body: Record<string, unknown>) {
  const incomplete = body.incomplete_details && typeof body.incomplete_details === "object"
    ? body.incomplete_details as { reason?: unknown }
    : null;
  const output = Array.isArray(body.output) ? body.output : [];
  return {
    status: typeof body.status === "string" ? body.status : "unknown",
    incompleteReason:
      typeof incomplete?.reason === "string" ? incomplete.reason : null,
    outputTypes: output
      .map((item) => item && typeof item === "object" ? (item as { type?: unknown }).type : null)
      .filter((type): type is string => typeof type === "string"),
  };
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
  /** Pre-formatted context (Markdown, not JSON — see coach-snapshot-markdown.ts). */
  data: string;
  maxOutputTokens?: number;
}): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("AI coach is not configured. Add OPENAI_API_KEY in Vercel.");

  const request = async (tokenLimit: number) => {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: COACH_MODEL,
        store: false,
        instructions: SAFETY_INSTRUCTIONS,
        input: `${task}\n\n${data}`,
        max_output_tokens: tokenLimit,
        text: { format: { type: "json_schema", name, strict: true, schema } },
      }),
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const error = body.error && typeof body.error === "object" ? body.error as { message?: string } : null;
      throw new Error(error?.message || `OpenAI request failed (${response.status}).`);
    }
    return body;
  };

  let lastBody: Record<string, unknown> = {};
  const tokenLimits = [maxOutputTokens, Math.min(Math.max(maxOutputTokens * 2, 3600), 8000)];
  for (let attempt = 0; attempt < tokenLimits.length; attempt++) {
    lastBody = await request(tokenLimits[attempt]);
    const text = extractOutputText(lastBody);
    if (text) {
      try {
        return JSON.parse(text) as T;
      } catch {
        // A token-limited response can contain truncated JSON. Retry once with
        // a larger allowance, then return a useful error below.
      }
    }
  }

  const metadata = responseMetadata(lastBody);
  // Do not log health data or model text. These fields are enough to diagnose
  // incomplete Responses API calls safely in production.
  console.error("Fitlog Coach returned no parseable structured output", {
    model: COACH_MODEL,
    ...metadata,
  });
  if (metadata.status === "incomplete") {
    throw new Error("The coach response was cut off. Please try again.");
  }
  throw new Error("The coach returned an invalid response. Please try again.");
}
