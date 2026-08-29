import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-user";
import { getFoodSearchPreferences } from "@/lib/foods/preferences";
import { searchAllFoodProviders } from "@/lib/foods/search";

export async function GET(req: Request) {
  const user = await requireAppUser();
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") ?? "").trim().slice(0, 120);
  if (query.length < 3) return NextResponse.json([]);

  const { region, language } = await getFoodSearchPreferences(user.id);
  const result = await searchAllFoodProviders({
    query,
    region,
    language,
    limit: 36,
  });

  if (result.foods.length === 0 && result.providers.every(({ ok }) => !ok)) {
    return NextResponse.json(
      { error: "Food search is temporarily unavailable." },
      { status: 502 }
    );
  }
  return NextResponse.json(result.foods);
}
