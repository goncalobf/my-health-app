import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { measurementLogs } from "@/db/schema";
import { todayISO } from "@/lib/utils";
import { requireAppUser } from "@/lib/app-user";

export async function GET() {
  const user = await requireAppUser();
  return NextResponse.json(await db.select().from(measurementLogs).where(eq(measurementLogs.userId, user.id)).orderBy(asc(measurementLogs.day)));
}

const PHOTO_DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,/;

export async function POST(req: Request) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));
  const numeric = (key: string) => body[key] === "" || body[key] == null ? null : Number(body[key]);

  const notes = body.notes ? String(body.notes) : null;
  if (notes && notes.length > 1000) {
    return NextResponse.json({ error: "Notes must be 1000 characters or fewer." }, { status: 400 });
  }

  const photoDataUrl = body.photoDataUrl ? String(body.photoDataUrl) : null;
  if (photoDataUrl) {
    if (!PHOTO_DATA_URL_RE.test(photoDataUrl)) {
      return NextResponse.json({ error: "Photo must be a JPEG, PNG, or WebP data URL." }, { status: 400 });
    }
    if (photoDataUrl.length > 2_000_000) {
      return NextResponse.json({ error: "Photo is too large." }, { status: 400 });
    }
  }

  const [row] = await db.insert(measurementLogs).values({
    userId: user.id,
    day: body.day || todayISO(),
    waistCm: numeric("waistCm"), chestCm: numeric("chestCm"), armsCm: numeric("armsCm"),
    thighsCm: numeric("thighsCm"), bodyFatPct: numeric("bodyFatPct"),
    notes,
    photoDataUrl,
  }).returning();
  return NextResponse.json(row, { status: 201 });
}
