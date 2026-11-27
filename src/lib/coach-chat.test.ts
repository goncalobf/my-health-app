import assert from "node:assert/strict";
import test from "node:test";
import { COACH_QUESTION_LIMIT, coachChatResponse, formatCoachConversation, readCoachReply } from "./coach-chat";

test("Coach history sends user text and past answers without reply metadata", () => {
  const transcript = formatCoachConversation([
    { role: "user", content: "How should I adjust today?\nI also have class." },
    { role: "assistant", content: JSON.stringify({
      answer: "Consider the combined workload.", followUpQuestions: ["More?"],
      caution: "Check how you feel.", memoryNote: "Stored separately.",
    }) },
    { role: "assistant", content: "An older plain-text reply." },
  ]);
  assert.match(transcript, /\*\*User\*\*\n> How should I adjust today\?\n> I also have class\./);
  assert.match(transcript, /\*\*Coach\*\*\n> Consider the combined workload\./);
  assert.match(transcript, /An older plain-text reply/);
  assert.doesNotMatch(transcript, /More\?|Check how you feel|Stored separately|memoryNote/);
});

test("Coach replies accept legacy answers and filter unusable generated follow-ups", () => {
  assert.deepEqual(readCoachReply('{"answer":"Older answer."}'), {
    answer: "Older answer.", caution: null, followUpQuestions: [],
  });
  const reply = coachChatResponse.parse({
    answer: "  Try a lighter session. ",
    followUpQuestions: ["Can you suggest mobility? ", "Can you suggest mobility?", "x".repeat(COACH_QUESTION_LIMIT + 1)],
    caution: null, memoryNote: null,
  });
  assert.equal(reply.answer, "Try a lighter session.");
  assert.deepEqual(reply.followUpQuestions, ["Can you suggest mobility?"]);
  assert.equal(coachChatResponse.safeParse({ ...reply, answer: "" }).success, false);
});
