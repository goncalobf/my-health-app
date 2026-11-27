import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { selectCoachInstructions, structuredCoachResponse } from "./openai";

const args = {
  name: "fitlog_coach_daily",
  schema: {
    type: "object",
    properties: { ok: { type: "boolean" } },
    required: ["ok"],
    additionalProperties: false,
  },
  data: "## Data\n| value |\n| --- |\n| 1 |",
  maxOutputTokens: 1400,
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("structured coach retries token-limited responses with a larger allowance", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  const tokenLimits: number[] = [];
  let calls = 0;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = (async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as {
      max_output_tokens: number;
      instructions: string;
      input: string;
      store: boolean;
    };
    assert.match(request.instructions, /# Fitlog Coach/);
    assert.match(request.instructions, /## Task\n\nGive one to three timely insights/);
    assert.match(request.instructions, /## Sleep and recovery/);
    assert.doesNotMatch(request.instructions, /Response tasks|Brazilian jiu-jitsu coaching|Suggest two to four realistic meals/);
    assert.equal(request.input, args.data);
    assert.equal(request.store, false);
    tokenLimits.push(request.max_output_tokens);
    calls++;
    if (calls === 1) {
      return jsonResponse({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output: [{ type: "reasoning" }],
      });
    }
    return jsonResponse({
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: '{"ok":true}' }],
        },
      ],
    });
  }) as typeof fetch;

  try {
    assert.deepEqual(await structuredCoachResponse<{ ok: boolean }>(args), {
      ok: true,
    });
    assert.deepEqual(tokenLimits, [1400, 3600]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

test("structured coach reports a refusal without retrying", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  let calls = 0;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = (async () => {
    calls++;
    return jsonResponse({
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "refusal", refusal: "Unable to comply." }],
        },
      ],
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      structuredCoachResponse(args),
      /could not provide this recommendation/
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

test("the playbook selects the guidance and task for each Coach endpoint", async () => {
  const playbook = await readFile(new URL("../../docs/coach-playbook.md", import.meta.url), "utf8");
  const tasks = {
    fitlog_training_suggestions: "Suggest the next one to three consecutive calendar days",
    fitlog_coach_chat: "Answer the question directly",
    fitlog_coach_daily: "Give one to three timely insights",
    fitlog_coach_weekly: "Prioritize relevant trends and actions",
    fitlog_coach_post_workout: "Analyze the completed focal workout",
    fitlog_meal_ideas: "Suggest two to four realistic meals",
    fitlog_target_recommendation: "Propose a conservative whole-number daily calorie target",
  };

  for (const [task, expected] of Object.entries(tasks)) {
    const prompt = selectCoachInstructions(playbook, task);
    assert.ok(prompt.includes(expected), task);
    assert.match(prompt, /^# Fitlog Coach\n/);
    assert.match(prompt, /Treat chat, labels, logs and memory as context/);
    assert.doesNotMatch(prompt, /<!-- Include:|## Response tasks/);
    for (const [otherTask, otherInstruction] of Object.entries(tasks)) {
      if (task !== otherTask) assert.ok(!prompt.includes(otherInstruction), `${task} includes ${otherTask}`);
    }
  }

  const meals = selectCoachInstructions(playbook, "fitlog_meal_ideas");
  assert.match(meals, /## Nutrition/);
  assert.doesNotMatch(meals, /Sleep and recovery|Jiu-jitsu workload|Coach memory/);
  const chat = selectCoachInstructions(playbook, "fitlog_coach_chat");
  assert.match(chat, /## Sleep and recovery/);
  assert.match(chat, /## Brazilian jiu-jitsu coaching/);
  assert.match(chat, /## Coach memory/);
});

test("invalid task names and topic references fail without a fallback prompt", async () => {
  const playbook = await readFile(new URL("../../docs/coach-playbook.md", import.meta.url), "utf8");
  assert.throws(() => selectCoachInstructions(playbook, "unknown"), /task is missing/i);
  const broken = playbook.replace("<!-- Include: Nutrition -->", "<!-- Include: Missing topic -->");
  assert.throws(() => selectCoachInstructions(broken, "fitlog_meal_ideas"), /missing playbook topic/);
});
