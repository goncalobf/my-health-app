export interface CoachInsightItem {
  category: "training" | "nutrition" | "recovery" | "progress";
  title: string;
  observation: string;
  evidence: string[];
  suggestion: string;
  confidence: "low" | "medium" | "high";
  requiresConfirmation: boolean;
}

export interface CoachInsightPayload {
  headline: string;
  insights: CoachInsightItem[];
  caution: string | null;
  memoryNote: string | null;
}

export interface CoachChatPayload {
  answer: string;
  followUpQuestions: string[];
  caution: string | null;
  memoryNote: string | null;
}

export interface CoachMealPayload {
  summary: string;
  ideas: {
    name: string;
    why: string;
    portion: string;
    estimatedCalories: number;
    estimatedProteinG: number;
    estimatedCarbsG: number;
    estimatedFatG: number;
    ingredients: string[];
  }[];
  caution: string | null;
}

export interface CoachTargetPayload {
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  proteinRuleGPerKg: number;
  proteinGPerKg: number;
  fatCaloriesPct: number;
  summary: string;
  rationale: string[];
  dataQuality: "low" | "medium" | "high";
  caution: string | null;
}

export type CoachCaloriePayload = Omit<
  CoachTargetPayload,
  | "targetProteinG"
  | "targetCarbsG"
  | "targetFatG"
  | "proteinRuleGPerKg"
  | "proteinGPerKg"
  | "fatCaloriesPct"
>;

export const insightSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "insights", "caution", "memoryNote"],
  properties: {
    headline: { type: "string" },
    insights: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "title", "observation", "evidence", "suggestion", "confidence", "requiresConfirmation"],
        properties: {
          category: { type: "string", enum: ["training", "nutrition", "recovery", "progress"] },
          title: { type: "string" },
          observation: { type: "string" },
          evidence: { type: "array", items: { type: "string" }, maxItems: 4 },
          suggestion: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          requiresConfirmation: { type: "boolean" },
        },
      },
    },
    caution: { type: ["string", "null"] },
    memoryNote: { type: ["string", "null"] },
  },
} as const;

export const chatSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "followUpQuestions", "caution", "memoryNote"],
  properties: {
    answer: { type: "string" },
    followUpQuestions: { type: "array", items: { type: "string" }, maxItems: 3 },
    caution: { type: ["string", "null"] },
    memoryNote: { type: ["string", "null"] },
  },
} as const;

export const mealSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "ideas", "caution"],
  properties: {
    summary: { type: "string" },
    ideas: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "why", "portion", "estimatedCalories", "estimatedProteinG", "estimatedCarbsG", "estimatedFatG", "ingredients"],
        properties: {
          name: { type: "string" }, why: { type: "string" }, portion: { type: "string" },
          estimatedCalories: { type: "number" }, estimatedProteinG: { type: "number" },
          estimatedCarbsG: { type: "number" }, estimatedFatG: { type: "number" },
          ingredients: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
        },
      },
    },
    caution: { type: ["string", "null"] },
  },
} as const;

export const calorieTargetSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "targetCalories",
    "summary",
    "rationale",
    "dataQuality",
    "caution",
  ],
  properties: {
    targetCalories: { type: "integer" },
    summary: { type: "string" },
    rationale: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" },
    },
    dataQuality: { type: "string", enum: ["low", "medium", "high"] },
    caution: { type: ["string", "null"] },
  },
} as const;
