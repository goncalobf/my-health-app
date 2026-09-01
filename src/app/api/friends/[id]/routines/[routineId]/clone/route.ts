import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-user";
import { cloneRoutineForUser, resolveAcceptedFriendship } from "@/lib/friends-data";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; routineId: string }> }
) {
  const user = await requireAppUser();
  const { id, routineId } = await params;
  const resolved = await resolveAcceptedFriendship(Number(id), user.id);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const cloned = await cloneRoutineForUser(resolved.friendUserId, Number(routineId), user.id);
  if (!cloned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(cloned, { status: 201 });
}
