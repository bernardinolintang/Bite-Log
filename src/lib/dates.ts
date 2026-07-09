const DEFAULT_TZ = process.env.APP_TIMEZONE || "Asia/Singapore";

export function dateStringFor(epochMs: number, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(epochMs));
}

export function todayString(tz: string = DEFAULT_TZ): string {
  return dateStringFor(Date.now(), tz);
}

/** n date strings ascending, ending today. DST edge days are acceptable for this app. */
export function lastNDates(n: number, tz: string = DEFAULT_TZ): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(dateStringFor(Date.now() - i * 86_400_000, tz));
  return out;
}

export function weekdayLetter(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "narrow", timeZone: "UTC" }).format(
    new Date(`${dateStr}T00:00:00Z`),
  );
}

export function formatDisplayDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateStr}T00:00:00Z`));
}
