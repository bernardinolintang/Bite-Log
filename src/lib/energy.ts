export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export interface BodyProfile {
  sex: Sex | null;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel | null;
}

/**
 * Multipliers describe daily life WITHOUT deliberate exercise, because logged
 * workouts are added on top. Picking "very active" and also logging every gym
 * session counts the same effort twice.
 */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Desk job, little walking",
  light: "On your feet a bit, light walking",
  moderate: "Fairly active day to day",
  active: "On your feet most of the day",
  very_active: "Physical job",
};

export function ageFrom(birthYear: number, now = new Date()): number {
  return now.getUTCFullYear() - birthYear;
}

/** Mifflin-St Jeor — the most accurate simple BMR estimate for most adults. */
export function bmr(p: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
}): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return base + (p.sex === "male" ? 5 : -161);
}

export interface Maintenance {
  bmr: number;
  /** Maintenance before exercise: BMR x activity multiplier. */
  baseline: number;
}

/** Null when the profile is incomplete — the caller should ask the user to fill it in. */
export function maintenance(p: BodyProfile, now = new Date()): Maintenance | null {
  if (!p.sex || !p.birthYear || !p.heightCm || !p.weightKg || !p.activityLevel) return null;
  const age = ageFrom(p.birthYear, now);
  if (age < 13 || age > 100) return null;
  const b = bmr({ sex: p.sex, weightKg: p.weightKg, heightCm: p.heightCm, age });
  return {
    bmr: Math.round(b),
    baseline: Math.round(b * ACTIVITY_MULTIPLIERS[p.activityLevel]),
  };
}

export interface EnergyBalance {
  eaten: number;
  baseline: number;
  burned: number;
  /** Everything burned today: baseline living + logged exercise. */
  out: number;
  /** Positive = deficit (under), negative = surplus (over). */
  deficit: number;
}

export function energyBalance(eaten: number, baseline: number, burned: number): EnergyBalance {
  const out = baseline + burned;
  return {
    eaten: Math.round(eaten),
    baseline: Math.round(baseline),
    burned: Math.round(burned),
    out: Math.round(out),
    deficit: Math.round(out - eaten),
  };
}

/** 7700 kcal ≈ 1 kg of body fat — the standard planning figure. */
export const KCAL_PER_KG = 7700;

export function weeklyRateKg(dailyDeficit: number): number {
  return Math.round(((dailyDeficit * 7) / KCAL_PER_KG) * 100) / 100;
}
