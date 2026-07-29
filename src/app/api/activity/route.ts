import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dateStringFor } from "@/lib/dates";
import { addActivity, getActivitiesForDates } from "@/lib/db/queries";

export const maxDuration = 30;

const TZ = process.env.APP_TIMEZONE || "Asia/Singapore";

const bodySchema = z.object({
  /** Where it came from: "shortcuts" for Apple Health, "strava", "manual", … */
  source: z.string().trim().min(1).max(40).default("shortcuts"),
  description: z.string().trim().min(1).max(200).default("Workout"),
  calories: z.number().positive().max(10_000),
  /** ISO timestamp or epoch ms. Defaults to now. */
  at: z.union([z.string(), z.number()]).optional(),
  /**
   * Stable id from the source. Send one and re-posting the same workout is a no-op,
   * which makes a repeating Shortcuts automation safe.
   */
  externalId: z.string().trim().max(200).optional(),
});

/**
 * Ingest calories burned from outside the bot — an iOS Shortcuts automation reading
 * Apple Health, a Strava relay, or anything else that can POST JSON.
 *
 *   curl -X POST $APP_URL/api/activity \
 *     -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json" \
 *     -d '{"description":"Incline walk","calories":520,"externalId":"health-2026-07-30"}'
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    // Parse from req.url rather than req.nextUrl so this stays a plain-Request handler.
    const qs = new URL(req.url).searchParams.get("key");
    if (auth !== `Bearer ${secret}` && qs !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Send at least { calories: number }.", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { source, description, calories, at, externalId } = parsed.data;

  const when = at === undefined ? Date.now() : typeof at === "number" ? at : Date.parse(at);
  if (!Number.isFinite(when)) {
    return NextResponse.json({ error: "`at` is not a valid date." }, { status: 400 });
  }

  const loggedDate = dateStringFor(when, TZ);
  const id = await addActivity({
    source,
    externalId: externalId ?? null,
    description,
    calories,
    loggedAt: when,
    loggedDate,
  });

  if (!id) {
    return NextResponse.json({ ok: true, duplicate: true, date: loggedDate });
  }
  const dayTotal = (await getActivitiesForDates([loggedDate])).reduce(
    (s, a) => s + a.calories,
    0,
  );
  return NextResponse.json({ ok: true, id, date: loggedDate, burnedThatDay: Math.round(dayTotal) });
}
