import { describe, expect, it } from "vitest";
import { dateStringFor, formatDisplayDate, lastNDates, weekdayLetter } from "@/lib/dates";

describe("dateStringFor", () => {
  it("converts an epoch to YYYY-MM-DD in the given timezone", () => {
    // 2026-07-08 17:00 UTC = 2026-07-09 01:00 in Singapore
    const epoch = Date.UTC(2026, 6, 8, 17, 0, 0);
    expect(dateStringFor(epoch, "Asia/Singapore")).toBe("2026-07-09");
    expect(dateStringFor(epoch, "UTC")).toBe("2026-07-08");
  });
});

describe("lastNDates", () => {
  it("returns n ascending dates ending today", () => {
    const dates = lastNDates(7, "Asia/Singapore");
    expect(dates).toHaveLength(7);
    expect(dates[6]).toBe(dateStringFor(Date.now(), "Asia/Singapore"));
    expect(dates[0] < dates[6]).toBe(true);
  });
});

describe("weekdayLetter", () => {
  it("returns the narrow weekday for a date string", () => {
    expect(weekdayLetter("2026-07-09")).toBe("T"); // Thursday
    expect(weekdayLetter("2026-07-12")).toBe("S"); // Sunday
  });
});

describe("formatDisplayDate", () => {
  it("formats a date string for display", () => {
    expect(formatDisplayDate("2026-07-09")).toContain("9");
    expect(formatDisplayDate("2026-07-09")).toContain("Jul");
  });
});
