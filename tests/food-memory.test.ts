import { describe, expect, it } from "vitest";
import type { FoodItem } from "../src/lib/ai/schema";
import {
  applyFoodMemory,
  mealFingerprint,
  mealLabel,
  normalizeFoodKey,
} from "../src/lib/food-memory";

const template = {
  id: "t1",
  foodKey: "chicken rice",
  foodName: "Chicken Rice",
  quantityDesc: "1 plate",
  grams: 400,
  calories: 650,
  proteinG: 28,
  carbsG: 75,
  fatG: 22,
  fibreG: 2,
  sodiumMg: 900,
  useCount: 3,
  updatedAt: Date.now(),
};

describe("normalizeFoodKey", () => {
  it("lowercases and trims", () => {
    expect(normalizeFoodKey("  Chicken Rice  ")).toBe("chicken rice");
  });
});

describe("mealFingerprint", () => {
  it("sorts food names for stable key", () => {
    const items = [{ food_name: "Milo" }, { food_name: "Chicken Rice" }];
    expect(mealFingerprint(items)).toBe("chicken rice|milo");
  });
});

describe("mealLabel", () => {
  it("prefers ai summary", () => {
    expect(mealLabel("Nasi lemak set", [{ food_name: "x" } as FoodItem])).toBe("Nasi lemak set");
  });

  it("joins item names when no summary", () => {
    const items = [{ food_name: "Eggs" }, { food_name: "Toast" }] as FoodItem[];
    expect(mealLabel(null, items)).toBe("Eggs, Toast");
  });
});

describe("applyFoodMemory", () => {
  it("replaces matching items with saved values", () => {
    const items: FoodItem[] = [
      {
        food_name: "Chicken Rice",
        quantity_desc: "1 bowl",
        grams: null,
        calories: 500,
        protein_g: 20,
        carbs_g: 60,
        fat_g: 15,
        fibre_g: null,
        sodium_mg: null,
        confidence: 0.5,
        assumptions: ["Assumed standard portion"],
      },
    ];
    const result = applyFoodMemory(items, [template]);
    expect(result[0].calories).toBe(650);
    expect(result[0].confidence).toBe(1);
    expect(result[0].assumptions).toContain("Based on your saved correction");
  });

  it("leaves non-matching items unchanged", () => {
    const items: FoodItem[] = [
      {
        food_name: "Iced Milo",
        quantity_desc: "1 cup",
        grams: null,
        calories: 150,
        protein_g: 4,
        carbs_g: 28,
        fat_g: 3,
        fibre_g: null,
        sodium_mg: null,
        confidence: 0.8,
        assumptions: [],
      },
    ];
    const result = applyFoodMemory(items, [template]);
    expect(result[0].calories).toBe(150);
  });
});
