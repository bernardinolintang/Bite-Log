import { NextRequest, NextResponse } from "next/server";
import { handleUpdate, type TgUpdate } from "@/lib/telegram/handle";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  if (!update) return NextResponse.json({ ok: true });

  // Telegram retries any non-200 with the same update, which would double-log a meal.
  // Swallow failures here; handleUpdate already reports problems to the user.
  try {
    await handleUpdate(update);
  } catch (err) {
    console.error("telegram webhook failed:", err);
  }
  return NextResponse.json({ ok: true });
}
