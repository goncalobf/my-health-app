import { NextResponse } from "next/server";
import { searchFoods } from "@/lib/openfoodfacts";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json([]);
  try {
    const results = await searchFoods(q);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
