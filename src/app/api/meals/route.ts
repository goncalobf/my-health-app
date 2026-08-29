import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { mealTemplates, nutritionLogs } from "@/db/schema";
import { todayISO } from "@/lib/utils";
import { requireAppUser } from "@/lib/app-user";

interface MealItem { name: string; barcode?: string | null; quantityG: number; calories: number; proteinG: number; carbsG: number; fatG: number; }

export async function GET() {
  const user = await requireAppUser();
  const rows = await db.select().from(mealTemplates).where(eq(mealTemplates.userId, user.id)).orderBy(desc(mealTemplates.createdAt));
  return NextResponse.json(rows.map((r) => ({ ...r, items: JSON.parse(r.itemsJson) as MealItem[] })));
}

export async function POST(req: Request) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));
  if (body.logTemplateId) {
    const [template] = await db.select().from(mealTemplates).where(and(eq(mealTemplates.id, Number(body.logTemplateId)), eq(mealTemplates.userId, user.id)));
    if (!template) return NextResponse.json({ error: "Meal not found" }, { status: 404 });
    const items = JSON.parse(template.itemsJson) as MealItem[];
    const scale = Number(body.scale) || 1;
    const rows = await db.insert(nutritionLogs).values(items.map((x) => ({
      userId: user.id,
      day: body.day || todayISO(), meal: body.meal || "snack", name: x.name,
      barcode: x.barcode ?? null, quantityG: x.quantityG * scale, calories: x.calories * scale,
      proteinG: x.proteinG * scale, carbsG: x.carbsG * scale, fatG: x.fatG * scale,
    }))).returning();
    return NextResponse.json(rows, { status: 201 });
  }
  const name = String(body.name ?? "").trim();
  const items = Array.isArray(body.items) ? body.items : [];
  if (!name || !items.length) return NextResponse.json({ error: "Meal name and items required" }, { status: 400 });
  const [row] = await db.insert(mealTemplates).values({ userId: user.id, name, itemsJson: JSON.stringify(items) }).returning();
  return NextResponse.json(row, { status: 201 });
}
