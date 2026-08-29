import "server-only";

import { unstable_cache } from "next/cache";
import { normalize, record } from "@/lib/foods/openfoodfacts-normalizer";
import type {
  FoodLanguage,
  FoodProvider,
  FoodResult,
} from "@/lib/foods/types";

const USER_AGENT = "Fitlog/0.2 (https://fitlog.site)";
const PRODUCT_FIELDS = [
  "code",
  "product_name",
  "product_name_pt",
  "product_name_de",
  "product_name_fr",
  "product_name_it",
  "product_name_en",
  "generic_name",
  "brands",
  "categories",
  "image_small_url",
  "image_front_small_url",
  "serving_size",
  "nutriments",
  "nutrition",
  "countries_tags",
  "lang",
];

async function searchFoodsUncached(
  query: string,
  language: FoodLanguage
): Promise<FoodResult[]> {
  const languages = Array.from(new Set([language, "pt", "de", "fr", "it", "en"]));
  const response = await fetch("https://search.openfoodfacts.org/search", {
    method: "POST",
    headers: { "User-Agent": USER_AGENT, "Content-Type": "application/json" },
    body: JSON.stringify({
      q: query,
      page_size: 24,
      langs: languages,
      fields: PRODUCT_FIELDS,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`Open Food Facts search failed (${response.status}).`);
  }
  const data = record(await response.json());
  const hits = Array.isArray(data.hits) ? data.hits : [];
  return hits
    .map((product) => normalize(product, language))
    .filter((food): food is FoodResult => food !== null);
}

const cachedSearchFoods = unstable_cache(
  searchFoodsUncached,
  ["food-provider", "openfoodfacts", "search", "v2"],
  { revalidate: 21_600 }
);

export function searchFoods(
  query: string,
  language: FoodLanguage = "en"
): Promise<FoodResult[]> {
  return cachedSearchFoods(query.trim().toLowerCase(), language);
}

async function lookupBarcodeUncached(
  code: string,
  language: FoodLanguage,
  country: string
): Promise<FoodResult | null> {
  const url =
    `https://world.openfoodfacts.org/api/v3.6/product/${encodeURIComponent(code)}.json?` +
    new URLSearchParams({
      fields: PRODUCT_FIELDS.filter((field) => field !== "nutriments").join(","),
      lc: language,
      cc: country.toLowerCase(),
    }).toString();
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(8_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Open Food Facts barcode lookup failed (${response.status}).`);
  }
  const data = record(await response.json());
  const result = record(data.result);
  if (result.id !== "product_found") return null;
  return normalize(data.product, language);
}

const cachedLookupBarcode = unstable_cache(
  lookupBarcodeUncached,
  ["food-provider", "openfoodfacts", "barcode", "v3.6"],
  { revalidate: 86_400 }
);

export function lookupBarcode(
  code: string,
  language: FoodLanguage = "en",
  country = "CH"
): Promise<FoodResult | null> {
  return cachedLookupBarcode(code, language, country);
}

export const openFoodFactsProvider: FoodProvider = {
  id: "openfoodfacts",
  search: ({ query, language }) => searchFoods(query, language),
  lookupBarcode: (code, context) =>
    lookupBarcode(
      code,
      context.language,
      context.region === "PT" ? "PT" : "CH"
    ),
};

export type { FoodResult } from "@/lib/foods/types";
export { normalize } from "@/lib/foods/openfoodfacts-normalizer";
