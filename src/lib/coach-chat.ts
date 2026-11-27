import { z } from "zod";
import type { CoachChatPayload } from "./coach";

export const COACH_QUESTION_LIMIT = 1200;

export interface CoachMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export const coachChatResponse = z.object({
  answer: z.string().trim().min(1),
  followUpQuestions: z.array(z.string()).max(3),
  caution: z.string().nullable(),
  memoryNote: z.string().nullable(),
}).transform((payload) => ({
  ...payload,
  followUpQuestions: [...new Set(payload.followUpQuestions.map((question) => question.trim()))]
    .filter((question) => question.length > 0 && question.length <= COACH_QUESTION_LIMIT),
}));

const storedReply = z.object({
  answer: z.string(),
  followUpQuestions: z.array(z.string()).optional(),
  caution: z.string().nullable().optional(),
});

export function readCoachReply(content: string): Omit<CoachChatPayload, "memoryNote"> {
  try {
    const reply = storedReply.safeParse(JSON.parse(content));
    if (reply.success) return {
      answer: reply.data.answer,
      followUpQuestions: reply.data.followUpQuestions ?? [],
      caution: reply.data.caution ?? null,
    };
  } catch {
    // Older replies can be plain text.
  }
  return { answer: content, followUpQuestions: [], caution: null };
}

export function formatCoachConversation(messages: { role: string; content: string }[]) {
  return messages.map(({ role, content }) => {
    const text = role === "assistant" ? readCoachReply(content).answer : content;
    return [`**${role === "user" ? "User" : "Coach"}**`, ...text.split(/\r?\n/).map((line) => `> ${line}`)].join("\n");
  }).join("\n\n");
}
