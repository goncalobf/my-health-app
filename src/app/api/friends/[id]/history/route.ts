import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-user";
import { getFriendHistory, resolveAcceptedFriendship } from "@/lib/friends-data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  const resolved = await resolveAcceptedFriendship(Number(id), user.id);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await getFriendHistory(resolved.friendUserId));
}
