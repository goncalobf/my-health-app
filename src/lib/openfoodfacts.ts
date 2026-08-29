// Thin wrapper around the free Open Food Facts API. No key required.

const UA = "Fitlog/0.1 (personal health tracker)";

export interface FoodResult {
  barcode: string | null;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  // Macros per 100 g.
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingSize: string | null;
  source: string;
  sourceId: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}

export function normalize(p: any): FoodResult | null {
  if (!p) return null;
  const name = p.product_name || p.product_name_en || p.generic_name || "";
  if (!name) return null;
  const n = p.nutriments || {};
  return {
    barcode: p.code ? String(p.code) : null,
    name,
    brand: p.brands ? String(p.brands).split(",")[0].trim() : null,
    imageUrl: p.image_front_small_url || p.image_small_url || null,
    calories: num(n["energy-kcal_100g"]),
    proteinG: num(n["proteins_100g"]),
    carbsG: num(n["carbohydrates_100g"]),
    fatG: num(n["fat_100g"]),
    servingSize: p.serving_size || null,
    source: "Open Food Facts",
    sourceId: p.code ? String(p.code) : null,
  };
}

export async function searchFoods(query: string): Promise<FoodResult[]> {
  const fields = [
    "code",
    "product_name",
    "product_name_en",
    "generic_name",
    "brands",
    "image_small_url",
    "image_front_small_url",
    "serving_size",
    "nutriments",
  ];
  const res = await fetch("https://search.openfoodfacts.org/search", {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/json" },
    body: JSON.stringify({
      q: query,
      page_size: 24,
      langs: ["en"],
      fields,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    throw new Error(`Open Food Facts search failed (${res.status}).`);
  }
  const data = await res.json();
  return (data.hits || [])
    .map(normalize)
    .filter((f: FoodResult | null): f is FoodResult => f !== null);
}

export async function lookupBarcode(code: string): Promise<FoodResult | null> {
  const url =
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      code
    )}.json?` +
    new URLSearchParams({
      fields:
        "code,product_name,product_name_en,generic_name,brands,image_small_url,image_front_small_url,serving_size,nutriments",
    }).toString();
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 1) return null;
  return normalize(data.product);
}
