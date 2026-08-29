import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { nutritionLogs } from "@/db/schema";
import { todayISO } from "@/lib/utils";
import { requireAppUser } from "@/lib/app-user";

export async function GET(req: Request) {
  const user = await requireAppUser();
  const { searchParams } = new URL(req.url);
  const day = searchParams.get("day") || todayISO();
  const rows = await db
    .select()
    .from(nutritionLogs)
    .where(and(eq(nutritionLogs.userId, user.id), eq(nutritionLogs.day, day)))
    .orderBy(asc(nutritionLogs.createdAt));

  const totals = rows.reduce(
    (acc, r) => ({
      calories: acc.calories + r.calories,
      proteinG: acc.proteinG + r.proteinG,
      carbsG: acc.carbsG + r.carbsG,
      fatG: acc.fatG + r.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  return NextResponse.json({ day, logs: rows, totals });
}

export async function POST(req: Request) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const [row] = await db
    .insert(nutritionLogs)
    .values({
      userId: user.id,
      day: body.day || todayISO(),
      meal: body.meal || "snack",
      name,
      barcode: body.barcode ? String(body.barcode) : null,
      quantityG: body.quantityG != null ? Number(body.quantityG) : 100,
      calories: body.calories != null ? Number(body.calories) : 0,
      proteinG: body.proteinG != null ? Number(body.proteinG) : 0,
      carbsG: body.carbsG != null ? Number(body.carbsG) : 0,
      fatG: body.fatG != null ? Number(body.fatG) : 0,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
