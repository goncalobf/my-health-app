import { readFile } from "node:fs/promises";
import path from "node:path";

export const COACH_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

export function isCoachConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

// Read lazily so the playbook is only needed when the Coach runs.
function readCoachPlaybook() {
  return readFile(path.join(process.cwd(), "docs", "coach-playbook.md"), "utf8");
}

export function selectCoachInstructions(playbook: string, name: string): string {
  const [shared, ...topics] = playbook.replace(/\r\n/g, "\n").trim().split(/^## /m);
  const tasks = topics.pop();
  if (!tasks?.startsWith("Response tasks\n")) throw new Error("Coach playbook has no response tasks");

  const task = tasks.split(/^### /m).slice(1).find((block) => block.startsWith(`${name}\n`));
  const match = task?.match(/^[^\n]+\n<!-- Include: (.+) -->\n([\s\S]+)$/);
  if (!match?.[2].trim()) throw new Error("Coach task is missing from the playbook");

  const instructions = match[1].split(",").map((heading) => {
    const topic = topics.find((block) => block.startsWith(`${heading.trim()}\n`));
    if (!topic) throw new Error("Coach task references a missing playbook topic");
    return `## ${topic.trim()}`;
  });
  return [shared.trim(), ...instructions, `## Task\n\n${match[2].trim()}`].join("\n\n");
}

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
  data,
  maxOutputTokens = 1800,
}: {
  name: string;
  schema: Record<string, unknown>;
  /** Pre-formatted context (Markdown, not JSON — see coach-snapshot-markdown.ts). */
  data: string;
  maxOutputTokens?: number;
}): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("AI coach is not configured. Add OPENAI_API_KEY in Vercel.");

  const instructions = selectCoachInstructions(await readCoachPlaybook(), name);
  const signal = AbortSignal.timeout(25_000);

  const request = async (tokenLimit: number) => {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: COACH_MODEL,
        store: false,
        instructions,
        input: data,
        max_output_tokens: tokenLimit,
        text: { format: { type: "json_schema", name, strict: true, schema } },
      }),
    });
    if (!response.ok) {
      console.error("Fitlog Coach provider request failed", { model: COACH_MODEL, status: response.status });
      throw new Error("The coach service is temporarily unavailable.");
    }
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
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
