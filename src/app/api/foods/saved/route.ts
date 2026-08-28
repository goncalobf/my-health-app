import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { nutritionLogs, savedFoods } from "@/db/schema";

export async function GET() {
  const favorites = await db.select().from(savedFoods).orderBy(desc(savedFoods.createdAt));
  const logs = await db.select().from(nutritionLogs).orderBy(desc(nutritionLogs.createdAt)).limit(80);
  const seen = new Set<string>();
  const recent = logs.filter((x) => {
    const key = x.name.toLowerCase();
    if (seen.has(key) || x.quantityG <= 0) return false;
    seen.add(key); return true;
  }).slice(0, 12).map((x) => ({
    name: x.name, barcode: x.barcode, servingName: null, servingGrams: x.quantityG,
    caloriesPer100: (x.calories / x.quantityG) * 100,
    proteinPer100: (x.proteinG / x.quantityG) * 100,
    carbsPer100: (x.carbsG / x.quantityG) * 100,
    fatPer100: (x.fatG / x.quantityG) * 100,
  }));
  return NextResponse.json({ favorites, recent });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!String(body.name ?? "").trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const [row] = await db.insert(savedFoods).values({
    name: String(body.name).trim(), barcode: body.barcode ? String(body.barcode) : null,
    servingName: body.servingName ? String(body.servingName) : null,
    servingGrams: Number(body.servingGrams) || 100,
    caloriesPer100: Number(body.caloriesPer100) || 0,
    proteinPer100: Number(body.proteinPer100) || 0,
    carbsPer100: Number(body.carbsPer100) || 0,
    fatPer100: Number(body.fatPer100) || 0,
  }).returning();
  return NextResponse.json(row, { status: 201 });
}
