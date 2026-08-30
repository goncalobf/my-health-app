import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-user";
import { getFoodSearchPreferences } from "@/lib/foods/preferences";
import { lookupFoodBarcode } from "@/lib/foods/search";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await requireAppUser();
  const { code } = await params;
  if (!/^\d{6,18}$/.test(code)) {
    return NextResponse.json({ error: "Invalid barcode" }, { status: 400 });
  }
  const { region, language } = await getFoodSearchPreferences(user.id);

  try {
    const result = await lookupFoodBarcode({ code, region, language });
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
  }
}
