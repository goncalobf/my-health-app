export const FOOD_REGIONS = ["PT", "CH", "both"] as const;
export const FOOD_LANGUAGES = ["pt", "de", "fr", "it", "en"] as const;

export type FoodRegion = (typeof FOOD_REGIONS)[number];
export type FoodLanguage = (typeof FOOD_LANGUAGES)[number];
export type FoodProviderId = "portfir" | "swiss" | "usda" | "openfoodfacts";

export interface NormalizedFood {
  id: string;
  provider: FoodProviderId;
  providerId: string;
  barcode: string | null;
  name: string;
  localizedNames: Partial<Record<FoodLanguage, string>>;
  brand: string | null;
  imageUrl: string | null;
  category: string | null;
  servingSize: string | null;
  basisQuantity: 100;
  basisUnit: "g";
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  saturatedFatG: number | null;
  saltG: number | null;
  sodiumMg: number | null;
  countryCodes: string[];
  source: string;
  sourceVersion: string | null;
  sourceUrl: string;
  attribution: string;
}

export type FoodResult = Omit<
  NormalizedFood,
  "calories" | "proteinG" | "carbsG" | "fatG"
> & {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export interface FoodSearchContext {
  query: string;
  region: FoodRegion;
  language: FoodLanguage;
  limit: number;
}

export interface FoodProvider {
  id: FoodProviderId;
  search(context: FoodSearchContext): Promise<FoodResult[]>;
  lookupBarcode?(
    code: string,
    context: Pick<FoodSearchContext, "region" | "language">
  ): Promise<FoodResult | null>;
}
