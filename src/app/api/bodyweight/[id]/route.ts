import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bodyweightLogs } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isInteger(entryId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  await db
    .delete(bodyweightLogs)
    .where(and(eq(bodyweightLogs.id, entryId), eq(bodyweightLogs.userId, user.id)));
  return new NextResponse(null, { status: 204 });
}
