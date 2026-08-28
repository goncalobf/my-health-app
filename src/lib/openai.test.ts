import assert from "node:assert/strict";
import test from "node:test";
import { structuredCoachResponse } from "./openai";

const args = {
  name: "test_response",
  schema: {
    type: "object",
    properties: { ok: { type: "boolean" } },
    required: ["ok"],
    additionalProperties: false,
  },
  task: "Return the test response.",
  data: { value: 1 },
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
    const request = JSON.parse(String(init?.body)) as { max_output_tokens: number };
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
