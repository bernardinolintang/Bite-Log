import { describe, expect, it } from "vitest";
import type { ProfileRow } from "@/lib/db/queries";
import {
  nextStep,
  parseNumber,
  stepAfter,
  stepById,
  STEPS,
  valueForField,
} from "@/lib/telegram/setup-flow";

const empty: ProfileRow = {
  id: 1,
  sex: null,
  birthYear: null,
  heightCm: null,
  weightKg: null,
  activityLevel: null,
  targetDeficit: null,
  updatedAt: 0,
};

const full: ProfileRow = {
  ...empty,
  sex: "male",
  birthYear: 1999,
  heightCm: 178,
  weightKg: 72,
  activityLevel: "light",
  targetDeficit: 500,
};

describe("nextStep", () => {
  it("starts at sex for an empty profile", () => {
    expect(nextStep(empty)?.id).toBe("sex");
  });

  it("skips fields that are already filled", () => {
    expect(nextStep({ ...empty, sex: "male" })?.id).toBe("age");
    expect(nextStep({ ...empty, sex: "male", birthYear: 1999 })?.id).toBe("height");
  });

  it("returns null once everything is answered", () => {
    expect(nextStep(full)).toBeNull();
  });

  it("walks the whole sequence in order", () => {
    expect(STEPS.map((s) => s.id)).toEqual([
      "sex",
      "age",
      "height",
      "weight",
      "activity",
      "target",
    ]);
  });
});

describe("stepAfter", () => {
  it("moves to the next unanswered step", () => {
    expect(stepAfter("sex", { ...empty, sex: "male" })?.id).toBe("age");
  });

  it("does not go backwards to an earlier blank field", () => {
    // Weight answered out of order; after "weight" it should look forward only.
    expect(stepAfter("weight", { ...empty, weightKg: 72 })?.id).toBe("activity");
  });

  it("returns null at the end", () => {
    expect(stepAfter("target", full)).toBeNull();
  });
});

describe("parseNumber", () => {
  it("pulls a number out of a natural reply", () => {
    expect(parseNumber("178cm", [100, 250])).toBe(178);
    expect(parseNumber("about 72 kg", [25, 400])).toBe(72);
    expect(parseNumber("27", [13, 100])).toBe(27);
    expect(parseNumber("72.5", [25, 400])).toBe(72.5);
  });

  it("rejects values outside the plausible range", () => {
    expect(parseNumber("900", [25, 400])).toBeNull();
    expect(parseNumber("5", [13, 100])).toBeNull();
  });

  it("returns null when there is no number", () => {
    expect(parseNumber("chicken rice", [25, 400])).toBeNull();
  });
});

describe("valueForField", () => {
  it("converts an age answer into a birth year", () => {
    const step = stepById("age")!;
    expect(valueForField(step, 27, new Date("2026-07-30T00:00:00Z"))).toBe(1999);
  });

  it("passes other measurements through unchanged", () => {
    expect(valueForField(stepById("height")!, 178)).toBe(178);
    expect(valueForField(stepById("weight")!, 72)).toBe(72);
  });
});
