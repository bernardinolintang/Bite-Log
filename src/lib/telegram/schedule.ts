import type { MealType } from "@/lib/meals";

export type SlotName = "breakfast" | "lunch" | "dinner" | "wrapup";

export interface Slot {
  name: SlotName;
  /** Local time in APP_TIMEZONE. */
  hour: number;
  minute: number;
  /** The meal this check-in is about; the wrap-up reviews the whole day. */
  mealType: MealType | null;
  prompt: string;
}

/**
 * Check-in times, local to APP_TIMEZONE. Edit these to change when the bot pings you —
 * the scheduler reads them directly, so no cron change is needed.
 */
export const SLOTS: Slot[] = [
  {
    name: "breakfast",
    hour: 9,
    minute: 0,
    mealType: "breakfast",
    prompt: "Morning ☀️ Had breakfast yet? Send me a photo or just tell me what you ate.",
  },
  {
    name: "lunch",
    hour: 12,
    minute: 30,
    mealType: "lunch",
    prompt: "Lunchtime 🍜 What are you having? A photo works, or describe it.",
  },
  {
    name: "dinner",
    hour: 19,
    minute: 0,
    mealType: "dinner",
    prompt: "Evening 🌙 What did dinner look like?",
  },
  {
    name: "wrapup",
    hour: 21,
    minute: 30,
    mealType: null,
    prompt: "Wrapping up the day — here's where you landed:",
  },
];

/** How long after its time a slot is still worth sending. Covers scheduler drift. */
export const GRACE_MINUTES = 100;

export function localHourMinute(epochMs: number, tz: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(epochMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return { hour: get("hour"), minute: get("minute") };
}

/**
 * The slot that is currently due, or null. A slot is due from its time until
 * GRACE_MINUTES later, so a scheduler that fires every 30 min never misses one.
 */
export function dueSlot(epochMs: number, tz: string): Slot | null {
  const { hour, minute } = localHourMinute(epochMs, tz);
  const nowMins = hour * 60 + minute;
  let best: Slot | null = null;
  let bestMins = -1;
  for (const s of SLOTS) {
    const slotMins = s.hour * 60 + s.minute;
    if (nowMins >= slotMins && nowMins < slotMins + GRACE_MINUTES && slotMins > bestMins) {
      best = s;
      bestMins = slotMins;
    }
  }
  return best;
}

/** Which meal a spontaneous log belongs to, based on when it was sent. */
export function mealTypeForTime(epochMs: number, tz: string): MealType {
  const { hour } = localHourMinute(epochMs, tz);
  if (hour >= 4 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 16 && hour < 22) return "dinner";
  return "snack";
}
