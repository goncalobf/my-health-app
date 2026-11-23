import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activitySessions } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";
import { getMobilityRoutine, mobilityActivityType } from "@/lib/mobility";

const logSchema = z.object({
  routineId: z.string().min(1).max(60),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
}).strict();

export async function POST(req: Request) {
  const user = await requireAppUser();
  const parsed = logSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid mobility session." }, { status: 400 });
  const routine = getMobilityRoutine(parsed.data.routineId);
  if (!routine) return Response.json({ error: "Mobility routine not found." }, { status: 404 });

  const startedAt = new Date(parsed.data.startedAt);
  const finishedAt = new Date(parsed.data.finishedAt);
  const elapsed = finishedAt.getTime() - startedAt.getTime();
  if (elapsed <= 0 || elapsed > 12 * 60 * 60_000 || finishedAt.getTime() > Date.now() + 5 * 60_000) {
    return Response.json({ error: "Invalid mobility session times." }, { status: 400 });
  }

  const type = mobilityActivityType(routine);
  const [existing] = await db.select({ id: activitySessions.id }).from(activitySessions).where(and(
    eq(activitySessions.userId, user.id),
    eq(activitySessions.type, type),
    eq(activitySessions.startedAt, startedAt),
    eq(activitySessions.finishedAt, finishedAt),
  )).limit(1);
  if (existing) return Response.json(existing);

  const [session] = await db.insert(activitySessions).values({
    userId: user.id, type, startedAt, finishedAt, durationSeconds: Math.ceil(elapsed / 1000),
  }).returning({ id: activitySessions.id });
  return Response.json(session, { status: 201 });
}
