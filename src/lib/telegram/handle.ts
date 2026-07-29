import { analyzeMeal, RateLimitError } from "@/lib/ai/analyze";
import { applyFoodMemory } from "@/lib/food-memory";
import { getAllFoodTemplates } from "@/lib/db/memory";
import {
  claimChat,
  deleteMeal,
  getLinkedChat,
  getMealsByDate,
  getMealsForDates,
  getRecentMeals,
  getSettings,
  unlinkChat,
} from "@/lib/db/queries";
import { dbItemToFoodItem } from "@/lib/convert";
import { lastNDates, todayString } from "@/lib/dates";
import { saveMeal } from "@/lib/meals";
import { calcTotals } from "@/lib/nutrition";
import { answerQuestion, classifyIntent } from "./agent";
import {
  answerCallbackQuery,
  editMessageText,
  esc,
  fetchPhotoDataUrl,
  sendChatAction,
  sendMessage,
} from "./api";
import { formatDaySummary, formatLoggedMeal, mealsAsContext } from "./format";
import { mealTypeForTime } from "./schedule";

const TZ = process.env.APP_TIMEZONE || "Asia/Singapore";

/* Telegram's update shape, narrowed to the parts this bot uses. */
interface TgUser {
  username?: string;
  first_name?: string;
}
interface TgMessage {
  message_id: number;
  chat: { id: number | string };
  from?: TgUser;
  text?: string;
  caption?: string;
  photo?: { file_id: string; file_size?: number; width: number }[];
}
export interface TgUpdate {
  message?: TgMessage;
  callback_query?: {
    id: string;
    data?: string;
    from?: TgUser;
    message?: { message_id: number; chat: { id: number | string } };
  };
}

const HELP = [
  "Here's what I can do:",
  "",
  "📸 <b>Send a photo of your meal</b> — I'll break down the calories and macros and log it.",
  "✍️ <b>Or just type it</b> — \"chicken rice and iced milo\".",
  "❓ <b>Ask me anything</b> — \"what did I eat today?\", \"how many calories so far?\", \"how much protein left?\"",
  "",
  "/today — today's log and totals",
  "/undo — remove the last thing I logged",
  "/help — this message",
  "",
  "I'll also check in around breakfast, lunch and dinner. If you've already logged that meal, I'll stay quiet.",
].join("\n");

async function dayCalories(date: string): Promise<number> {
  const meals = await getMealsByDate(date);
  return calcTotals(meals.flatMap((m) => m.items.map(dbItemToFoodItem))).calories;
}

/** Telegram sends several sizes; take the largest under ~1.2MB to bound token cost. */
function pickPhoto(photos: { file_id: string; file_size?: number; width: number }[]): string {
  const sorted = [...photos].sort((a, b) => a.width - b.width);
  const ok = sorted.filter((p) => (p.file_size ?? 0) < 1_200_000);
  return (ok.length ? ok[ok.length - 1] : sorted[0]).file_id;
}

async function logMeal(
  chatId: string,
  opts: { imageDataUrl?: string; description?: string },
): Promise<void> {
  const mealType = mealTypeForTime(Date.now(), TZ);
  let analysis;
  try {
    analysis = await analyzeMeal({
      imageDataUrl: opts.imageDataUrl,
      description: opts.description,
      mealType,
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      await sendMessage(chatId, "I'm being rate-limited right now — give me a minute and send that again 🙏");
      return;
    }
    console.error("telegram analyze failed:", err);
    await sendMessage(chatId, "I couldn't read that one. Try another photo, or describe it in words?");
    return;
  }

  if (analysis.no_food || analysis.items.length === 0) {
    await sendMessage(
      chatId,
      opts.imageDataUrl
        ? "I don't see any food in that photo 🤔 Try another angle, or tell me what it was."
        : "That doesn't look like food to me — what did you eat?",
    );
    return;
  }

  const items = applyFoodMemory(analysis.items, await getAllFoodTemplates());
  const id = await saveMeal({
    mealType,
    inputType: opts.imageDataUrl ? "photo" : "text",
    description: opts.description ?? null,
    aiSummary: analysis.meal_summary || null,
    items,
  });

  const prefs = await getSettings();
  const text = formatLoggedMeal(
    analysis.meal_summary,
    mealType,
    items,
    await dayCalories(todayString(TZ)),
    prefs.calorieTarget,
  );
  await sendMessage(chatId, text, [[{ text: "🗑 Undo", callback_data: `del:${id}` }]]);
}

async function handleQuestion(chatId: string, question: string): Promise<void> {
  // A week of context covers "yesterday", "this week" and "so far today".
  const meals = await getMealsForDates(lastNDates(7, TZ));
  const prefs = await getSettings();
  try {
    const answer = await answerQuestion(
      question,
      mealsAsContext(meals),
      todayString(TZ),
      prefs.calorieTarget,
    );
    await sendMessage(chatId, esc(answer) || "I'm not sure — try asking another way?");
  } catch (err) {
    if (err instanceof RateLimitError) {
      await sendMessage(chatId, "Rate-limited for a moment — ask me again shortly 🙏");
      return;
    }
    console.error("telegram question failed:", err);
    await sendMessage(chatId, "I couldn't work that one out. Try /today for the summary?");
  }
}

async function handleCommand(chatId: string, cmd: string, username: string | null): Promise<boolean> {
  switch (cmd) {
    case "/start": {
      const owner = await claimChat(chatId, username);
      if (owner.chatId !== chatId) {
        await sendMessage(chatId, "This is a private bot 🙈");
        return true;
      }
      await sendMessage(chatId, `Hey${username ? ` ${esc(username)}` : ""}! I'm your food journal 🥗\n\n${HELP}`);
      return true;
    }
    case "/help":
      await sendMessage(chatId, HELP);
      return true;
    case "/today": {
      const [meals, prefs] = await Promise.all([getMealsByDate(todayString(TZ)), getSettings()]);
      await sendMessage(chatId, formatDaySummary(meals, prefs));
      return true;
    }
    case "/undo": {
      const [last] = await getRecentMeals(1);
      if (!last) {
        await sendMessage(chatId, "Nothing to undo — your log is empty.");
        return true;
      }
      await deleteMeal(last.id);
      await sendMessage(chatId, `Removed <b>${esc(last.aiSummary || last.description || last.mealType)}</b>.`);
      return true;
    }
    case "/unlink":
      await unlinkChat();
      await sendMessage(chatId, "Unlinked. Send /start to link this chat again.");
      return true;
    default:
      return false;
  }
}

/**
 * Process one Telegram update. Always resolves — the webhook must return 200 or
 * Telegram will retry the same update forever.
 */
export async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) {
    const q = update.callback_query;
    const chatId = String(q.message?.chat.id ?? "");
    if (!chatId || !(await isOwner(chatId))) {
      await answerCallbackQuery(q.id);
      return;
    }
    if (q.data?.startsWith("del:")) {
      await deleteMeal(q.data.slice(4));
      await answerCallbackQuery(q.id, "Removed");
      if (q.message) await editMessageText(chatId, q.message.message_id, "🗑 <i>Removed from your log.</i>");
      return;
    }
    await answerCallbackQuery(q.id);
    return;
  }

  const msg = update.message;
  if (!msg) return;
  const chatId = String(msg.chat.id);
  const username = msg.from?.username ?? msg.from?.first_name ?? null;
  const text = (msg.text ?? msg.caption ?? "").trim();

  // /start is how the owner claims the bot, so it runs before the owner check.
  if (text.startsWith("/")) {
    const cmd = text.split(/\s+/)[0].split("@")[0].toLowerCase();
    if (cmd === "/start") {
      await handleCommand(chatId, "/start", username);
      return;
    }
    if (!(await isOwner(chatId))) return;
    if (await handleCommand(chatId, cmd, username)) return;
    await sendMessage(chatId, "I don't know that command. /help shows what I can do.");
    return;
  }

  if (!(await isOwner(chatId))) return;

  if (msg.photo?.length) {
    await sendChatAction(chatId);
    try {
      const imageDataUrl = await fetchPhotoDataUrl(pickPhoto(msg.photo));
      // A caption is extra context for the same meal, not a separate message.
      await logMeal(chatId, { imageDataUrl, description: text || undefined });
    } catch (err) {
      console.error("telegram photo failed:", err);
      await sendMessage(chatId, "I couldn't download that photo — mind sending it again?");
    }
    return;
  }

  if (!text) return;

  await sendChatAction(chatId);
  const intent = await classifyIntent(text);
  if (intent === "question") {
    await handleQuestion(chatId, text);
  } else if (intent === "chat") {
    await sendMessage(chatId, "🙂 Send me a meal photo, describe what you ate, or ask about your day.");
  } else {
    await logMeal(chatId, { description: text });
  }
}

async function isOwner(chatId: string): Promise<boolean> {
  const owner = await getLinkedChat();
  return !!owner && owner.chatId === chatId;
}
