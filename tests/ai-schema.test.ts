import { describe, expect, it } from "vitest";
import { analysisSchema } from "@/lib/ai/schema";

const validItem = {
  food_name: "Chicken rice",
  quantity_desc: "1 plate",
  grams: 400,
  calories: 600,
  protein_g: 30,
  carbs_g: 70,
  fat_g: 20,
  fibre_g: 2,
  sodium_mg: 1200,
  confidence: 0.8,
  assumptions: ["assumed roasted chicken"],
};

describe("analysisSchema", () => {
  it("parses a full valid response", () => {
    const parsed = analysisSchema.parse({
      meal_summary: "Chicken rice",
      items: [validItem],
      clarification_questions: ["Roasted or steamed chicken?"],
    });
    expect(parsed.items[0].calories).toBe(600);
    expect(parsed.clarification_questions).toHaveLength(1);
  });

  it("defaults missing optional numbers to null", () => {
    const { fibre_g, sodium_mg, grams, ...required } = validItem;
    const parsed = analysisSchema.parse({ meal_summary: "x", items: [required] });
    expect(parsed.items[0].fibre_g).toBeNull();
    expect(parsed.items[0].sodium_mg).toBeNull();
    expect(parsed.items[0].grams).toBeNull();
  });

  it("defaults missing clarification_questions to empty array", () => {
    const parsed = analysisSchema.parse({ meal_summary: "x", items: [validItem] });
    expect(parsed.clarification_questions).toEqual([]);
  });

  it("caps clarification questions at 3", () => {
    const parsed = analysisSchema.parse({
      meal_summary: "x",
      items: [validItem],
      clarification_questions: ["a", "b", "c", "d", "e"],
    });
    expect(parsed.clarification_questions).toHaveLength(3);
  });

  it("rejects an empty items array", () => {
    expect(analysisSchema.safeParse({ meal_summary: "x", items: [] }).success).toBe(false);
  });

  it("rejects out-of-range confidence", () => {
    const bad = { ...validItem, confidence: 1.5 };
    expect(analysisSchema.safeParse({ meal_summary: "x", items: [bad] }).success).toBe(false);
  });

  it("rejects non-numeric calories", () => {
    const bad = { ...validItem, calories: "lots" };
    expect(analysisSchema.safeParse({ meal_summary: "x", items: [bad] }).success).toBe(false);
  });
});
