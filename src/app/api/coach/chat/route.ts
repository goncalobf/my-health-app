import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { coachMessages } from "@/db/schema";
import { CoachChatPayload, chatSchema } from "@/lib/coach";
import { getCoachSnapshot } from "@/lib/coach-data";
import { isCoachConfigured, structuredCoachResponse } from "@/lib/openai";

export async function GET() {
  const recent = await db.select().from(coachMessages).orderBy(desc(coachMessages.createdAt)).limit(30);
  return NextResponse.json({ configured: isCoachConfigured(), messages: recent.reverse() });
}

export async function POST(req: Request) {
  if (!isCoachConfigured()) return NextResponse.json({ error: "Add OPENAI_API_KEY in Vercel to enable Fitlog Coach." }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim();
  if (!message || message.length > 1200) return NextResponse.json({ error: "Enter a question up to 1200 characters." }, { status: 400 });
  const history = await db.select().from(coachMessages).orderBy(desc(coachMessages.createdAt)).limit(10);
  const snapshot = await getCoachSnapshot({ days: 28 });
  try {
    const payload = await structuredCoachResponse<CoachChatPayload>({
      name: "fitlog_coach_chat", schema: chatSchema,
      task: "Answer the user's fitness question using their Fitlog data. Be direct, cite concrete values or dates from the data when relevant, and distinguish evidence from uncertainty.",
      data: { question: message, recentConversation: history.reverse().map((x) => ({ role: x.role, content: x.content })), snapshot },
    });
    await db.insert(coachMessages).values([
      { role: "user", content: message },
      { role: "assistant", content: JSON.stringify(payload) },
    ]);
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Coach request failed." }, { status: 502 });
  }
}

export async function DELETE() {
  await db.delete(coachMessages);
  return NextResponse.json({ ok: true });
}
