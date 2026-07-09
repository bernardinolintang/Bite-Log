export interface ItemNutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number | null;
  sodium_mg: number | null;
}

export type NutritionTotals = ItemNutrition;

const round1 = (v: number) => Math.round(v * 10) / 10;

function sumOptional(values: (number | null)[]): number | null {
  if (values.length === 0 || values.every((v) => v === null)) return null;
  return round1(values.reduce<number>((acc, v) => acc + (v ?? 0), 0));
}

export function calcTotals(items: ItemNutrition[]): NutritionTotals {
  return {
    calories: round1(items.reduce((a, i) => a + i.calories, 0)),
    protein_g: round1(items.reduce((a, i) => a + i.protein_g, 0)),
    carbs_g: round1(items.reduce((a, i) => a + i.carbs_g, 0)),
    fat_g: round1(items.reduce((a, i) => a + i.fat_g, 0)),
    fibre_g: sumOptional(items.map((i) => i.fibre_g)),
    sodium_mg: sumOptional(items.map((i) => i.sodium_mg)),
  };
}
