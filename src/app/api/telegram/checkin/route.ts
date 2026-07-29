import { NextRequest, NextResponse } from "next/server";
import { dbItemToFoodItem } from "@/lib/convert";
import { todayString } from "@/lib/dates";
import { getLinkedChat, getMealsByDate, getSettings, markCheckinSent } from "@/lib/db/queries";
import { sendMessage } from "@/lib/telegram/api";
import { formatDaySummary } from "@/lib/telegram/format";
import { dueSlot, SLOTS, type Slot } from "@/lib/telegram/schedule";
import { calcTotals } from "@/lib/nutrition";

export const maxDuration = 60;

const TZ = process.env.APP_TIMEZONE || "Asia/Singapore";

/**
 * Called by the scheduler every ~30 minutes. It works out which check-in is due
 * rather than trusting the caller, so the schedule lives in one place and a missed
 * or repeated run cannot misfire.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const qs = req.nextUrl.searchParams.get("key");
    if (auth !== `Bearer ${secret}` && qs !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const forced = req.nextUrl.searchParams.get("slot");
  const slot: Slot | null = forced
    ? (SLOTS.find((s) => s.name === forced) ?? null)
    : dueSlot(Date.now(), TZ);
  if (!slot) return NextResponse.json({ sent: false, reason: "no slot due" });

  const chat = await getLinkedChat();
  if (!chat) return NextResponse.json({ sent: false, reason: "no chat linked" });

  const today = todayString(TZ);
  const meals = await getMealsByDate(today);

  // Don't nag about a meal that's already in the log.
  if (slot.mealType && meals.some((m) => m.mealType === slot.mealType)) {
    return NextResponse.json({ sent: false, reason: `${slot.mealType} already logged` });
  }
  // The wrap-up is pointless on a day with nothing in it.
  if (slot.name === "wrapup" && meals.length === 0) {
    return NextResponse.json({ sent: false, reason: "nothing logged today" });
  }

  // Claim the slot before sending so a concurrent run can't send it too.
  if (!(await markCheckinSent(today, slot.name))) {
    return NextResponse.json({ sent: false, reason: "already sent" });
  }

  let text = slot.prompt;
  if (slot.name === "wrapup") {
    text = `${slot.prompt}\n\n${formatDaySummary(meals, await getSettings())}`;
  } else if (meals.length > 0) {
    const so_far = Math.round(calcTotals(meals.flatMap((m) => m.items.map(dbItemToFoodItem))).calories);
    text = `${slot.prompt}\n\n<i>You're at ${so_far} kcal so far today.</i>`;
  }

  await sendMessage(chat.chatId, text);
  return NextResponse.json({ sent: true, slot: slot.name });
}
