import { describe, expect, it, vi } from "vitest";
import { AnalysisError, analyzeWith } from "@/lib/ai/analyze";
import type { ChatMessage } from "@/lib/ai/types";

const validJson = JSON.stringify({
  meal_summary: "Toast",
  items: [
    {
      food_name: "Toast",
      quantity_desc: "2 slices",
      grams: 60,
      calories: 160,
      protein_g: 6,
      carbs_g: 30,
      fat_g: 2,
      fibre_g: 2,
      sodium_mg: 250,
      confidence: 0.9,
      assumptions: [],
    },
  ],
  clarification_questions: [],
});

const input = { description: "two slices of toast", mealType: "breakfast" };

describe("analyzeWith", () => {
  it("returns the parsed analysis on a first valid reply", async () => {
    const complete = vi.fn().mockResolvedValue(validJson);
    const result = await analyzeWith(complete, input);
    expect(result.items[0].food_name).toBe("Toast");
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("strips markdown fences before parsing", async () => {
    const complete = vi.fn().mockResolvedValue("```json\n" + validJson + "\n```");
    const result = await analyzeWith(complete, input);
    expect(result.items).toHaveLength(1);
  });

  it("retries once with feedback after an invalid reply", async () => {
    const complete = vi
      .fn()
      .mockResolvedValueOnce("this is not json")
      .mockResolvedValueOnce(validJson);
    const result = await analyzeWith(complete, input);
    expect(result.meal_summary).toBe("Toast");
    expect(complete).toHaveBeenCalledTimes(2);
    const retryMessages = complete.mock.calls[1][0] as ChatMessage[];
    const last = retryMessages[retryMessages.length - 1];
    expect(String(last.content)).toContain("ONLY the JSON object");
  });

  it("throws AnalysisError after two invalid replies", async () => {
    const complete = vi.fn().mockResolvedValue("still not json");
    await expect(analyzeWith(complete, input)).rejects.toBeInstanceOf(AnalysisError);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("retries when the schema rejects valid JSON", async () => {
    const badShape = JSON.stringify({ meal_summary: "x", items: [] });
    const complete = vi
      .fn()
      .mockResolvedValueOnce(badShape)
      .mockResolvedValueOnce(validJson);
    const result = await analyzeWith(complete, input);
    expect(result.items).toHaveLength(1);
    expect(complete).toHaveBeenCalledTimes(2);
  });
});
