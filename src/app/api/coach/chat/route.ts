import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { coachMessages } from "@/db/schema";
import { CoachChatPayload, chatSchema } from "@/lib/coach";
import { getCoachSnapshot, saveCoachMemoryNote } from "@/lib/coach-data";
import { formatCoachSnapshotAsMarkdown } from "@/lib/coach-snapshot-markdown";
import { isCoachConfigured, structuredCoachResponse } from "@/lib/openai";
import { requireAppUser } from "@/lib/app-user";
import { isRateLimited } from "@/lib/rate-limit";

export async function GET() {
  const user = await requireAppUser();
  const recent = await db.select().from(coachMessages).where(eq(coachMessages.userId, user.id)).orderBy(desc(coachMessages.createdAt)).limit(30);
  return NextResponse.json({ configured: isCoachConfigured(), messages: recent.reverse() });
}

export async function POST(req: Request) {
  const user = await requireAppUser();
  if (!isCoachConfigured()) return NextResponse.json({ error: "Add OPENAI_API_KEY in Vercel to enable Fitlog Coach." }, { status: 503 });
  if (isRateLimited(`coach-chat:${user.id}`, { max: 20, windowMs: 10 * 60 * 1000 })) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim();
  if (!message || message.length > 1200) return NextResponse.json({ error: "Enter a question up to 1200 characters." }, { status: 400 });
  const history = await db.select().from(coachMessages).where(eq(coachMessages.userId, user.id)).orderBy(desc(coachMessages.createdAt)).limit(10);
  const snapshot = await getCoachSnapshot({ userId: user.id, days: 28 });
  const historyText = history.length
    ? history.reverse().map((x) => `- **${x.role}:** ${x.content}`).join("\n")
    : "_No prior messages._";
  try {
    const payload = await structuredCoachResponse<CoachChatPayload>({
      name: "fitlog_coach_chat", schema: chatSchema,
      task: "Answer the user's fitness question using their Fitlog data. Be direct, cite concrete values or dates from the data when relevant, and distinguish evidence from uncertainty.",
      data: [
        `## User question\n${message}`,
        `## Recent conversation\n${historyText}`,
        formatCoachSnapshotAsMarkdown(snapshot),
      ].join("\n\n"),
    });
    await db.insert(coachMessages).values([
      { userId: user.id, role: "user", content: message },
      { userId: user.id, role: "assistant", content: JSON.stringify(payload) },
    ]);
    await saveCoachMemoryNote(user.id, payload.memoryNote);
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Coach request failed." }, { status: 502 });
  }
}

export async function DELETE() {
  const user = await requireAppUser();
  await db.delete(coachMessages).where(eq(coachMessages.userId, user.id));
  return NextResponse.json({ ok: true });
}
