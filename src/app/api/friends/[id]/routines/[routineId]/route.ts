import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-user";
import { getFriendRoutineDetail, resolveAcceptedFriendship } from "@/lib/friends-data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; routineId: string }> }
) {
  const user = await requireAppUser();
  const { id, routineId } = await params;
  const resolved = await resolveAcceptedFriendship(Number(id), user.id);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const detail = await getFriendRoutineDetail(resolved.friendUserId, Number(routineId));
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(detail);
}
