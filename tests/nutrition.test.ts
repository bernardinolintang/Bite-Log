import { describe, expect, it } from "vitest";
import { calcTotals, type ItemNutrition } from "@/lib/nutrition";

const item = (over: Partial<ItemNutrition>): ItemNutrition => ({
  calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: null, sodium_mg: null, ...over,
});

describe("calcTotals", () => {
  it("returns zeros and null optionals for an empty list", () => {
    expect(calcTotals([])).toEqual({
      calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: null, sodium_mg: null,
    });
  });

  it("sums calories and macros across items", () => {
    const totals = calcTotals([
      item({ calories: 300, protein_g: 20, carbs_g: 30, fat_g: 10 }),
      item({ calories: 150, protein_g: 5, carbs_g: 25, fat_g: 3 }),
    ]);
    expect(totals.calories).toBe(450);
    expect(totals.protein_g).toBe(25);
    expect(totals.carbs_g).toBe(55);
    expect(totals.fat_g).toBe(13);
  });

  it("rounds sums to 1 decimal place", () => {
    const totals = calcTotals([item({ fat_g: 1.15 }), item({ fat_g: 1.15 })]);
    expect(totals.fat_g).toBe(2.3);
  });

  it("keeps fibre/sodium null when every item is null", () => {
    const totals = calcTotals([item({}), item({})]);
    expect(totals.fibre_g).toBeNull();
    expect(totals.sodium_mg).toBeNull();
  });

  it("sums known fibre/sodium values, treating null as 0", () => {
    const totals = calcTotals([item({ fibre_g: 2.5, sodium_mg: 300 }), item({ fibre_g: null })]);
    expect(totals.fibre_g).toBe(2.5);
    expect(totals.sodium_mg).toBe(300);
  });
});
