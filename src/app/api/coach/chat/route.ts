import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { coachMessages } from "@/db/schema";
import { chatSchema } from "@/lib/coach";
import { COACH_QUESTION_LIMIT, coachChatResponse, formatCoachConversation } from "@/lib/coach-chat";
import { getCoachSnapshot } from "@/lib/coach-data";
import { clearCoachChat, getCoachRevisions, saveCoachExchange, saveCoachMemoryNote } from "@/lib/coach-storage";
import { formatCoachSnapshotAsMarkdown } from "@/lib/coach-snapshot-markdown";
import { isCoachConfigured, structuredCoachResponse } from "@/lib/openai";
import { requireAppUser } from "@/lib/app-user";
import { isRateLimited } from "@/lib/rate-limit";

const privateHeaders = { "Cache-Control": "no-store" };

function recentMessages(userId: number, limit: number) {
  return db.select().from(coachMessages).where(eq(coachMessages.userId, userId))
    .orderBy(desc(coachMessages.createdAt), desc(coachMessages.id)).limit(limit);
}

export async function GET() {
  const user = await requireAppUser();
  const recent = await recentMessages(user.id, 30);
  return Response.json({ configured: isCoachConfigured(), messages: recent.reverse() }, { headers: privateHeaders });
}

export async function POST(req: Request) {
  const user = await requireAppUser();
  if (!isCoachConfigured()) return Response.json({ error: "Coach is currently unavailable." }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > COACH_QUESTION_LIMIT) {
    return Response.json({ error: `Enter a question up to ${COACH_QUESTION_LIMIT} characters.` }, { status: 400 });
  }
  if (isRateLimited(`coach-chat:${user.id}`, { max: 20, windowMs: 10 * 60 * 1000 })) {
    return Response.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  try {
    const { chatRevision, memoryRevision } = await getCoachRevisions(user.id);
    const [history, snapshot] = await Promise.all([
      recentMessages(user.id, 10),
      getCoachSnapshot({ userId: user.id, days: 28 }),
    ]);
    const payload = coachChatResponse.parse(await structuredCoachResponse<unknown>({
      name: "fitlog_coach_chat", schema: chatSchema,
      data: [
        formatCoachSnapshotAsMarkdown(snapshot),
        history.length ? `## Recent conversation\n${formatCoachConversation(history.reverse())}` : "",
        `## User question\n${formatCoachConversation([{ role: "user", content: message }])}`,
      ].filter(Boolean).join("\n\n"),
    }));
    const messages = await saveCoachExchange(user.id, chatRevision, message, JSON.stringify(payload));
    if (!messages) {
      return Response.json({ error: "The conversation was cleared while Coach was replying." }, {
        status: 409, headers: privateHeaders,
      });
    }
    // The reply is already saved. An optional memory failure must not cause a resubmission.
    await saveCoachMemoryNote(user.id, memoryRevision, payload.memoryNote, chatRevision).catch(() => {
      console.error("Fitlog Coach could not save the optional memory note");
    });
    return Response.json({ ...payload, messages: messages.sort((a, b) => a.id - b.id) }, {
      status: 201, headers: privateHeaders,
    });
  } catch {
    return Response.json({ error: "Coach couldn’t reply. Your question is ready to retry." }, { status: 502 });
  }
}

export async function DELETE() {
  const user = await requireAppUser();
  await clearCoachChat(user.id);
  return Response.json({ ok: true }, { headers: privateHeaders });
}
