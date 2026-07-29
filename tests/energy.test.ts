import { describe, expect, it } from "vitest";
import {
  ageFrom,
  bmr,
  energyBalance,
  maintenance,
  weeklyRateKg,
  type BodyProfile,
} from "@/lib/energy";

const NOW = new Date("2026-07-30T00:00:00Z");

const complete: BodyProfile = {
  sex: "male",
  birthYear: 1999,
  heightCm: 175,
  weightKg: 70,
  activityLevel: "light",
};

describe("bmr", () => {
  it("matches Mifflin-St Jeor for men", () => {
    // 10*70 + 6.25*175 - 5*27 + 5 = 700 + 1093.75 - 135 + 5
    expect(bmr({ sex: "male", weightKg: 70, heightCm: 175, age: 27 })).toBeCloseTo(1663.75, 2);
  });

  it("matches Mifflin-St Jeor for women", () => {
    expect(bmr({ sex: "female", weightKg: 60, heightCm: 165, age: 30 })).toBeCloseTo(1320.25, 2);
  });

  it("is lower for women than men at identical stats", () => {
    const a = bmr({ sex: "male", weightKg: 70, heightCm: 175, age: 27 });
    const b = bmr({ sex: "female", weightKg: 70, heightCm: 175, age: 27 });
    expect(b).toBeLessThan(a);
    expect(a - b).toBe(166);
  });
});

describe("maintenance", () => {
  it("applies the activity multiplier to BMR", () => {
    const m = maintenance(complete, NOW)!;
    expect(m.bmr).toBe(1664);
    expect(m.baseline).toBe(Math.round(1663.75 * 1.375));
  });

  it("returns null when anything is missing", () => {
    for (const key of ["sex", "birthYear", "heightCm", "weightKg", "activityLevel"] as const) {
      expect(maintenance({ ...complete, [key]: null }, NOW)).toBeNull();
    }
  });

  it("rejects an implausible age", () => {
    expect(maintenance({ ...complete, birthYear: 2025 }, NOW)).toBeNull();
    expect(maintenance({ ...complete, birthYear: 1900 }, NOW)).toBeNull();
  });

  it("rises with activity level", () => {
    const sed = maintenance({ ...complete, activityLevel: "sedentary" }, NOW)!;
    const act = maintenance({ ...complete, activityLevel: "active" }, NOW)!;
    expect(act.baseline).toBeGreaterThan(sed.baseline);
  });
});

describe("ageFrom", () => {
  it("counts whole years", () => {
    expect(ageFrom(1999, NOW)).toBe(27);
  });
});

describe("energyBalance", () => {
  it("adds exercise on top of baseline burn", () => {
    const b = energyBalance(1800, 2300, 500);
    expect(b.out).toBe(2800);
    expect(b.deficit).toBe(1000);
  });

  it("reports a surplus as a negative deficit", () => {
    expect(energyBalance(3000, 2300, 0).deficit).toBe(-700);
  });

  it("handles a day with no exercise logged", () => {
    expect(energyBalance(2000, 2300, 0).deficit).toBe(300);
  });
});

describe("weeklyRateKg", () => {
  it("converts a daily deficit to kg per week", () => {
    expect(weeklyRateKg(500)).toBe(0.45);
    expect(weeklyRateKg(1100)).toBe(1);
  });

  it("is negative when in surplus", () => {
    expect(weeklyRateKg(-500)).toBe(-0.45);
  });
});
