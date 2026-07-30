/**
 * routeMessage validates the model's intent against a runtime allowlist. An intent
 * missing from that list is silently downgraded to log_meal — which once made every
 * correction get logged as a brand new meal. These tests pin the whole set.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const complete = vi.fn();

vi.mock("@/lib/ai/analyze", () => ({
  groqCompleter: () => complete,
}));

const { routeMessage } = await import("@/lib/telegram/agent");

const ALL_INTENTS = [
  "log_meal",
  "log_activity",
  "set_profile",
  "amend_date",
  "correct_meal",
  "converse",
] as const;

beforeEach(() => complete.mockReset());

describe("routeMessage", () => {
  it.each(ALL_INTENTS)("passes through the %s intent unchanged", async (intent) => {
    complete.mockResolvedValue(JSON.stringify({ intent, day_offset: 0 }));
    expect((await routeMessage("hi")).intent).toBe(intent);
  });

  it("falls back to log_meal for an unknown intent", async () => {
    complete.mockResolvedValue(JSON.stringify({ intent: "nonsense" }));
    expect((await routeMessage("hi")).intent).toBe("log_meal");
  });

  // Both of these land in the same catch as a thrown/rejected model call, so this
  // covers the "model misbehaved, keep working" path.
  it("falls back to log_meal when the model returns junk", async () => {
    complete.mockResolvedValue("not json at all");
    expect((await routeMessage("hi")).intent).toBe("log_meal");
  });

  it("falls back to log_meal when the model returns nothing", async () => {
    complete.mockResolvedValue(undefined);
    expect((await routeMessage("hi")).intent).toBe("log_meal");
  });

  it("clamps a day offset to the past week", async () => {
    complete.mockResolvedValue(JSON.stringify({ intent: "log_meal", day_offset: 3 }));
    expect((await routeMessage("x")).dayOffset).toBe(0);
    complete.mockResolvedValue(JSON.stringify({ intent: "log_meal", day_offset: -99 }));
    expect((await routeMessage("x")).dayOffset).toBe(-7);
  });

  it("keeps burned calories only when plausible", async () => {
    complete.mockResolvedValue(
      JSON.stringify({ intent: "log_activity", burned_calories: 520, activity: "Incline walk" }),
    );
    const ok = await routeMessage("x");
    expect(ok.burnedCalories).toBe(520);
    expect(ok.activity).toBe("Incline walk");

    complete.mockResolvedValue(JSON.stringify({ intent: "log_activity", burned_calories: 99_999 }));
    expect((await routeMessage("x")).burnedCalories).toBeNull();
  });

  it("rejects out-of-range body stats", async () => {
    complete.mockResolvedValue(
      JSON.stringify({
        intent: "set_profile",
        profile: { sex: "male", height_cm: 700, weight_kg: 72, age: 27 },
      }),
    );
    const p = (await routeMessage("x")).profile!;
    expect(p.heightCm).toBeUndefined(); // 700cm is not a person
    expect(p.weightKg).toBe(72);
    expect(p.sex).toBe("male");
  });

  it("converts an age to a birth year but prefers an explicit year", async () => {
    const year = new Date().getUTCFullYear();
    complete.mockResolvedValue(JSON.stringify({ intent: "set_profile", profile: { age: 27 } }));
    expect((await routeMessage("x")).profile!.birthYear).toBe(year - 27);

    complete.mockResolvedValue(
      JSON.stringify({ intent: "set_profile", profile: { age: 27, birth_year: 1999 } }),
    );
    expect((await routeMessage("x")).profile!.birthYear).toBe(1999);
  });

  it("returns a null profile when nothing usable was extracted", async () => {
    complete.mockResolvedValue(JSON.stringify({ intent: "set_profile", profile: { sex: "yes" } }));
    expect((await routeMessage("x")).profile).toBeNull();
  });
});
