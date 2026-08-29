import { NextResponse } from "next/server";
import { searchFoods } from "@/lib/openfoodfacts";
import { searchReferenceFoods } from "@/lib/fooddata-central";

function deduplicate(foods: Awaited<ReturnType<typeof searchFoods>>) {
  const seen = new Set<string>();
  return foods.filter((food) => {
    const key = `${food.name.toLowerCase()}|${food.brand?.toLowerCase() ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 3) return NextResponse.json([]);

  const searches = await Promise.allSettled([
    searchReferenceFoods(q),
    searchFoods(q),
  ]);
  const successful = searches
    .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof searchFoods>>> => result.status === "fulfilled")
    .flatMap((result) => result.value);

  if (successful.length === 0 && searches.every((result) => result.status === "rejected")) {
    return NextResponse.json(
      { error: "Food search is temporarily unavailable." },
      { status: 502 }
    );
  }

  return NextResponse.json(deduplicate(successful).slice(0, 36));
}
