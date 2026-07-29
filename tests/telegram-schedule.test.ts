import { describe, expect, it } from "vitest";
import { dueSlot, localHourMinute, mealTypeForTime, SLOTS } from "@/lib/telegram/schedule";

const TZ = "Asia/Singapore";

/** Epoch ms for a given Singapore wall-clock time (UTC+8, no DST). */
function sgt(hour: number, minute = 0): number {
  return Date.UTC(2026, 6, 29, hour - 8, minute);
}

describe("localHourMinute", () => {
  it("converts UTC to the configured timezone", () => {
    expect(localHourMinute(Date.UTC(2026, 6, 29, 1, 30), TZ)).toEqual({ hour: 9, minute: 30 });
  });

  it("handles the midnight rollover as hour 0, not 24", () => {
    expect(localHourMinute(Date.UTC(2026, 6, 29, 16, 0), TZ).hour).toBe(0);
  });
});

describe("dueSlot", () => {
  it("returns the slot exactly at its time", () => {
    expect(dueSlot(sgt(9, 0), TZ)?.name).toBe("breakfast");
    expect(dueSlot(sgt(12, 30), TZ)?.name).toBe("lunch");
    expect(dueSlot(sgt(19, 0), TZ)?.name).toBe("dinner");
    expect(dueSlot(sgt(21, 30), TZ)?.name).toBe("wrapup");
  });

  it("still returns the slot for a late scheduler run", () => {
    expect(dueSlot(sgt(10, 15), TZ)?.name).toBe("breakfast");
  });

  it("returns nothing once the grace window has passed", () => {
    expect(dueSlot(sgt(10, 45), TZ)).toBeNull();
    expect(dueSlot(sgt(3, 0), TZ)).toBeNull();
  });

  it("never fires before a slot's time", () => {
    expect(dueSlot(sgt(8, 59), TZ)).toBeNull();
  });

  it("picks the later slot when two windows overlap", () => {
    // dinner 19:00 + 100min grace runs past the 21:30 wrap-up
    expect(dueSlot(sgt(21, 30), TZ)?.name).toBe("wrapup");
  });

  it("covers every slot from some time of day", () => {
    const hit = new Set<string>();
    for (let m = 0; m < 24 * 60; m += 10) {
      const s = dueSlot(sgt(Math.floor(m / 60), m % 60), TZ);
      if (s) hit.add(s.name);
    }
    expect(hit.size).toBe(SLOTS.length);
  });
});

describe("mealTypeForTime", () => {
  it("maps times of day to meals", () => {
    expect(mealTypeForTime(sgt(8, 0), TZ)).toBe("breakfast");
    expect(mealTypeForTime(sgt(13, 0), TZ)).toBe("lunch");
    expect(mealTypeForTime(sgt(19, 30), TZ)).toBe("dinner");
    expect(mealTypeForTime(sgt(23, 0), TZ)).toBe("snack");
    expect(mealTypeForTime(sgt(2, 0), TZ)).toBe("snack");
  });
});
