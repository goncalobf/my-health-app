import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { garminPendingImports } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

export async function GET() {
  const user = await requireAppUser();
  const rows = await db
    .select({
      id: garminPendingImports.id,
      garminActivityId: garminPendingImports.garminActivityId,
      garminActivityType: garminPendingImports.garminActivityType,
      garminDataJson: garminPendingImports.garminDataJson,
      createdAt: garminPendingImports.createdAt,
    })
    .from(garminPendingImports)
    .where(
      and(
        eq(garminPendingImports.userId, user.id),
        isNull(garminPendingImports.labeledAt)
      )
    )
    .orderBy(desc(garminPendingImports.createdAt))
    .limit(50);

  return NextResponse.json(rows);
}
