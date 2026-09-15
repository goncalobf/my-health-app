import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, sessionSets } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

async function ownsSet(userId: number, sessionId: number, setId: number) {
  const [row] = await db
    .select({ row: sessionSets })
    .from(sessionSets)
    .innerJoin(sessions, eq(sessions.id, sessionSets.sessionId))
    .where(
      and(
        eq(sessionSets.id, setId),
        eq(sessionSets.sessionId, sessionId),
        eq(sessions.userId, userId),
      ),
    );
  return row?.row;
}

import { setPatch } from "@/lib/training-validation";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; setId: string }> },
) {
  const user = await requireAppUser();
  const { id, setId } = await params;
  if(![Number(id),Number(setId)].every(n=>Number.isSafeInteger(n)&&n>0&&n<=2147483647)) return NextResponse.json({error:"Invalid identifier"},{status:400});
  const existing = await ownsSet(user.id, Number(id), Number(setId));
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = setPatch.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !Object.keys(parsed.data).length)
    return NextResponse.json({ error: "Invalid set update" }, { status: 400 });
  const { completed, ...fields } = parsed.data;
  if (
    (fields.isWarmup ?? existing.isWarmup) &&
    (fields.isDropSet ?? existing.isDropSet)
  )
    return NextResponse.json(
      { error: "Warmups cannot also be drops" },
      { status: 400 },
    );
  const set = {
    ...fields,
    ...(completed === undefined
      ? {}
      : { completedAt: completed ? new Date() : null }),
  };

  const [row] = await db
    .update(sessionSets)
    .set(set)
    .where(eq(sessionSets.id, Number(setId)))
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; setId: string }> },
) {
  const user = await requireAppUser();
  const { id, setId } = await params;
  if(![Number(id),Number(setId)].every(n=>Number.isSafeInteger(n)&&n>0&&n<=2147483647)) return NextResponse.json({error:"Invalid identifier"},{status:400});
  if (!(await ownsSet(user.id, Number(id), Number(setId)))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db.delete(sessionSets).where(eq(sessionSets.id, Number(setId)));
  return NextResponse.json({ ok: true });
}
