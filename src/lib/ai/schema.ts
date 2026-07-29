import { z } from "zod";

const optionalNumber = z.number().min(0).nullish().default(null);

export const foodItemSchema = z.object({
  food_name: z.string().min(1),
  quantity_desc: z.string().default(""),
  grams: z.number().positive().nullish().default(null),
  calories: z.number().min(0),
  protein_g: z.number().min(0),
  carbs_g: z.number().min(0),
  fat_g: z.number().min(0),
  fibre_g: optionalNumber,
  sodium_mg: optionalNumber,
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string()).default([]),
});

export const analysisSchema = z
  .object({
    meal_summary: z.string().default(""),
    /** Set when the photo or description contains nothing edible — items is then empty. */
    no_food: z.boolean().default(false),
    items: z.array(foodItemSchema).default([]),
    clarification_questions: z
      .array(z.string())
      .default([])
      .transform((qs) => qs.slice(0, 3)),
  })
  .refine((a) => a.no_food || a.items.length > 0, {
    message: "items must not be empty unless no_food is true",
    path: ["items"],
  });

export type FoodItem = z.infer<typeof foodItemSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
