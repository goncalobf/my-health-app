import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { coachMemory, coachMessages, coachRevisions } from "@/db/schema";
import { withDbTransaction, type DbTransaction } from "@/db/transactions";
import { appendMemoryNote } from "@/lib/coach-memory";

type Revisions = Pick<typeof coachRevisions.$inferSelect, "chatRevision" | "memoryRevision">;

export async function getCoachRevisions(userId: number): Promise<Revisions> {
  const [row] = await db.select({
    chatRevision: coachRevisions.chatRevision,
    memoryRevision: coachRevisions.memoryRevision,
  }).from(coachRevisions).where(eq(coachRevisions.userId, userId));
  return row ?? { chatRevision: 0, memoryRevision: 0 };
}

function withCoachLock<T>(userId: number, work: (tx: DbTransaction, revisions: Revisions) => Promise<T>) {
  return withDbTransaction(async (tx) => {
    await tx.insert(coachRevisions).values({ userId }).onConflictDoNothing();
    const [revisions] = await tx.select().from(coachRevisions)
      .where(eq(coachRevisions.userId, userId)).for("update");
    return work(tx, revisions);
  });
}

export function saveCoachExchange(userId: number, revision: number, message: string, reply: string) {
  return withCoachLock(userId, async (tx, { chatRevision }) => {
    if (chatRevision !== revision) return null;
    return tx.insert(coachMessages).values([
      { userId, role: "user", content: message },
      { userId, role: "assistant", content: reply },
    ]).returning({
      id: coachMessages.id, role: coachMessages.role, content: coachMessages.content, createdAt: coachMessages.createdAt,
    });
  });
}

export function clearCoachChat(userId: number) {
  return withCoachLock(userId, async (tx) => {
    await tx.update(coachRevisions).set({ chatRevision: sql`${coachRevisions.chatRevision} + 1` })
      .where(eq(coachRevisions.userId, userId));
    await tx.delete(coachMessages).where(eq(coachMessages.userId, userId));
  });
}

async function readMemory(tx: DbTransaction, userId: number) {
  const [row] = await tx.select({ notes: coachMemory.notes })
    .from(coachMemory).where(eq(coachMemory.userId, userId));
  return row?.notes ?? [];
}

async function writeMemory(tx: DbTransaction, userId: number, notes: string[]) {
  await tx.insert(coachMemory).values({ userId, notes })
    .onConflictDoUpdate({ target: coachMemory.userId, set: { notes, updatedAt: new Date() } });
}

export async function saveCoachMemoryNote(
  userId: number, revision: number, note: string | null | undefined, expectedChatRevision?: number,
) {
  if (!note?.trim()) return;
  await withCoachLock(userId, async (tx, { chatRevision, memoryRevision }) => {
    if (memoryRevision !== revision || (expectedChatRevision !== undefined && chatRevision !== expectedChatRevision)) return;
    const notes = await readMemory(tx, userId);
    await writeMemory(tx, userId, appendMemoryNote(notes, note));
  });
}

export function forgetCoachMemory(userId: number, selection: { index: number; expectedNote?: string } | null) {
  return withCoachLock(userId, async (tx) => {
    const notes = await readMemory(tx, userId);
    if (selection) {
      if (selection.expectedNote !== undefined && notes[selection.index] !== selection.expectedNote) {
        return { status: "changed" } as const;
      }
      if (selection.index >= notes.length) return { status: "invalid" } as const;
    }

    const remaining = selection ? notes.filter((_, index) => index !== selection.index) : [];
    await tx.update(coachRevisions).set({ memoryRevision: sql`${coachRevisions.memoryRevision} + 1` })
      .where(eq(coachRevisions.userId, userId));
    await writeMemory(tx, userId, remaining);
    return { status: "forgotten", notes: remaining } as const;
  });
}
