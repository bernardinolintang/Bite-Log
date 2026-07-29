import { analyzeMeal, RateLimitError } from "@/lib/ai/analyze";
import { applyFoodMemory } from "@/lib/food-memory";
import { getAllFoodTemplates } from "@/lib/db/memory";
import {
  addActivity,
  appendTurn,
  type ChatTurn,
  claimChat,
  clearState,
  clearTurns,
  deleteMeal,
  getActivitiesForDates,
  getLinkedChat,
  getMealsByDate,
  getMealsForDates,
  getProfile,
  getRecentMeals,
  getRecentTurns,
  getSettings,
  getState,
  pruneTurns,
  setMealDate,
  setState,
  unlinkChat,
  updateProfile,
} from "@/lib/db/queries";
import { dbItemToFoodItem } from "@/lib/convert";
import { dateStringFor, formatDisplayDate, lastNDates, todayString } from "@/lib/dates";
import { energyBalance, maintenance } from "@/lib/energy";
import { saveMeal, type MealType } from "@/lib/meals";
import { calcTotals } from "@/lib/nutrition";
import { converse, routeMessage, type ProfilePatch } from "./agent";
import {
  answerCallbackQuery,
  editMessageText,
  esc,
  fetchPhotoDataUrl,
  type InlineButton,
  sendChatAction,
  sendMessage,
} from "./api";
import {
  formatBalance,
  formatDaySummary,
  formatLoggedMeal,
  formatProfile,
  formatWeekSummary,
  mealsAsContext,
} from "./format";
import { mealTypeForTime } from "./schedule";
import {
  nextStep,
  parseNumber,
  stepAfter,
  stepById,
  valueForField,
  type Step,
} from "./setup-flow";

const TZ = process.env.APP_TIMEZONE || "Asia/Singapore";
const DAY_MS = 86_400_000;

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
  "🔥 <b>Log workouts</b> — \"burnt 500 calories on an incline walk\".",
  "🕐 <b>Back-date it</b> — \"that was yesterday's dinner\" and I'll move it.",
  "❓ <b>Just talk to me</b> — \"am I in a deficit?\", \"how am I doing on protein?\"",
  "",
  "/menu — buttons for the common stuff",
  "/balance — today's deficit: eaten vs burned",
  "/week — 7 days with macros",
  "/profile — your stats and maintenance calories",
  "/undo — remove the last thing I logged",
  "/reset — forget our conversation so far",
  "",
  "I check in around breakfast, lunch and dinner. If you've already logged that meal, I stay quiet.",
].join("\n");

const MENU_BUTTONS: InlineButton[][] = [
  [
    { text: "📊 Today", callback_data: "day:0" },
    { text: "📅 Yesterday", callback_data: "day:-1" },
  ],
  [
    { text: "⚡️ Deficit", callback_data: "balance" },
    { text: "📈 Last 7 days", callback_data: "week" },
  ],
  [
    { text: "👤 Profile", callback_data: "profile" },
    { text: "🗑 Undo last", callback_data: "undo" },
  ],
];

/** Shown under a freshly logged meal. */
function loggedButtons(mealId: string): InlineButton[][] {
  return [
    [
      { text: "🗑 Undo", callback_data: `del:${mealId}` },
      { text: "⚡️ Deficit", callback_data: "balance" },
    ],
  ];
}

async function reply(chatId: string, text: string, buttons?: InlineButton[][]): Promise<void> {
  await sendMessage(chatId, text, buttons);
  await appendTurn("assistant", stripHtml(text));
}

/** The model wrote plain text; conversation memory should store it that way too. */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function dayCalories(date: string): Promise<number> {
  const meals = await getMealsByDate(date);
  return calcTotals(meals.flatMap((m) => m.items.map(dbItemToFoodItem))).calories;
}

function dateForOffset(offset: number): { at: number; date: string } {
  const at = Date.now() + offset * DAY_MS;
  return { at, date: dateStringFor(at, TZ) };
}

function dayLabel(offset: number, date: string): string {
  if (offset === 0) return "Today";
  if (offset === -1) return "Yesterday";
  return formatDisplayDate(date);
}

/** Telegram sends several sizes; take the largest under ~1.2MB to bound token cost. */
function pickPhoto(photos: { file_id: string; file_size?: number; width: number }[]): string {
  const sorted = [...photos].sort((a, b) => a.width - b.width);
  const ok = sorted.filter((p) => (p.file_size ?? 0) < 1_200_000);
  return (ok.length ? ok[ok.length - 1] : sorted[0]).file_id;
}

async function logMeal(
  chatId: string,
  opts: {
    imageDataUrl?: string;
    description?: string;
    dayOffset?: number;
    mealType?: MealType | null;
  },
): Promise<void> {
  const offset = opts.dayOffset ?? 0;
  const { at, date } = dateForOffset(offset);
  const mealType = opts.mealType ?? mealTypeForTime(at, TZ);

  let analysis;
  try {
    analysis = await analyzeMeal({
      imageDataUrl: opts.imageDataUrl,
      description: opts.description,
      mealType,
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      await reply(chatId, "I'm being rate-limited right now — give me a minute and send that again 🙏");
      return;
    }
    console.error("telegram analyze failed:", err);
    await reply(chatId, "I couldn't read that one. Try another photo, or describe it in words?");
    return;
  }

  if (analysis.no_food || analysis.items.length === 0) {
    await reply(
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
    loggedAt: at,
  });

  const prefs = await getSettings();
  let text = formatLoggedMeal(
    analysis.meal_summary,
    mealType,
    items,
    await dayCalories(date),
    prefs.calorieTarget,
  );
  if (offset !== 0) {
    text = `${text}\n\n<i>Logged under ${dayLabel(offset, date).toLowerCase()}, ${formatDisplayDate(date)}.</i>`;
  }
  await reply(chatId, text, loggedButtons(id));
}

/** "That was yesterday" — move the most recent meal to another day. */
async function amendDate(chatId: string, dayOffset: number): Promise<void> {
  const [last] = await getRecentMeals(1);
  if (!last) {
    await reply(chatId, "There's nothing logged yet for me to move.");
    return;
  }
  if (dayOffset === 0) {
    await reply(chatId, "Which day should I move it to? Say something like \"that was yesterday\".");
    return;
  }
  const { at, date } = dateForOffset(dayOffset);
  await setMealDate(last.id, at, date);
  const label = last.aiSummary || last.description || last.mealType;
  await reply(
    chatId,
    `Got it — moved <b>${esc(label)}</b> to ${formatDisplayDate(date)}. Today's total is back to <b>${Math.round(await dayCalories(todayString(TZ)))}</b> kcal.`,
  );
}

/** Log calories burned. Without a number we can't do the maths, so ask for one. */
async function logActivity(
  chatId: string,
  description: string,
  calories: number | null,
  dayOffset: number,
): Promise<void> {
  if (calories === null) {
    await reply(
      chatId,
      `Nice one 💪 How many calories did <b>${esc(description)}</b> burn? Your watch or the app should have a number.`,
    );
    return;
  }
  const { at, date } = dateForOffset(dayOffset);
  await addActivity({
    source: "telegram",
    description,
    calories,
    loggedAt: at,
    loggedDate: date,
  });
  const suffix = dayOffset !== 0 ? ` on ${formatDisplayDate(date)}` : "";
  await reply(
    chatId,
    `🔥 Logged <b>${esc(description)}</b> — ${Math.round(calories)} kcal${suffix}.\n\n${await balanceText(dayOffset)}`,
  );
}

async function applyProfile(chatId: string, patch: ProfilePatch): Promise<void> {
  const saved = await updateProfile(patch);
  const maint = maintenance(saved as never);
  const named = Object.keys(patch).length;
  if (!maint) {
    await reply(
      chatId,
      `Noted ${named} thing${named === 1 ? "" : "s"}. ${formatProfile(saved, null)}`,
    );
    return;
  }
  await reply(chatId, `Got it 👍\n\n${formatProfile(saved, maint)}`);
}

/** Everything the model needs to answer questions about food, workouts and deficit. */
async function buildContext(): Promise<string> {
  const dates = lastNDates(7, TZ);
  const today = todayString(TZ);
  const [meals, acts, prof, prefs] = await Promise.all([
    getMealsForDates(dates),
    getActivitiesForDates(dates),
    getProfile(),
    getSettings(),
  ]);
  const maint = maintenance(prof as never);
  const eatenToday = calcTotals(
    meals.filter((m) => m.loggedDate === today).flatMap((m) => m.items.map(dbItemToFoodItem)),
  ).calories;
  const burnedToday = acts
    .filter((a) => a.loggedDate === today)
    .reduce((s, a) => s + a.calories, 0);

  const lines = [`Today is ${today}.`];
  if (maint) {
    lines.push(
      `Their maintenance is about ${maint.baseline} kcal/day before exercise (BMR ${maint.bmr}).`,
    );
    const b = energyBalance(eatenToday, maint.baseline, burnedToday);
    lines.push(
      `Today: ate ${b.eaten}, burned ${b.burned} from exercise, total out ${b.out} — ` +
        (b.deficit >= 0 ? `a ${b.deficit} kcal deficit.` : `a ${-b.deficit} kcal surplus.`),
    );
  } else {
    lines.push("Their body stats aren't set, so maintenance calories are unknown.");
  }
  if (prof.targetDeficit) lines.push(`They are aiming for a ${prof.targetDeficit} kcal/day deficit.`);
  if (prefs.calorieTarget) lines.push(`Their calorie target is ${prefs.calorieTarget} kcal.`);

  lines.push("", "Meal log, last 7 days (oldest first):", mealsAsContext(meals));
  lines.push(
    "",
    "Exercise logged, last 7 days:",
    acts.length
      ? [...acts]
          .reverse()
          .map((a) => `${a.loggedDate}: ${a.description} — ${Math.round(a.calories)} kcal (${a.source})`)
          .join("\n")
      : "(none)",
  );
  return lines.join("\n");
}

/** `history` excludes the current message — it is passed separately as the final turn. */
async function handleConversation(
  chatId: string,
  text: string,
  history: ChatTurn[],
): Promise<void> {
  try {
    const answer = await converse(text, await buildContext(), history);
    await reply(chatId, esc(answer) || "I'm not sure how to answer that — try /menu?");
  } catch (err) {
    if (err instanceof RateLimitError) {
      await reply(chatId, "Rate-limited for a moment — ask me again shortly 🙏");
      return;
    }
    console.error("telegram converse failed:", err);
    await reply(chatId, "I couldn't work that one out. /menu has the summaries.");
  }
}

async function sendDay(chatId: string, offset: number): Promise<void> {
  const { date } = dateForOffset(offset);
  const [meals, prefs] = await Promise.all([getMealsByDate(date), getSettings()]);
  await reply(chatId, formatDaySummary(meals, prefs, dayLabel(offset, date)));
}

async function sendWeek(chatId: string): Promise<void> {
  const dates = lastNDates(7, TZ);
  const [meals, prefs, acts] = await Promise.all([
    getMealsForDates(dates),
    getSettings(),
    getActivitiesForDates(dates),
  ]);
  await reply(chatId, formatWeekSummary(meals, dates, prefs, acts));
}

async function balanceText(offset: number): Promise<string> {
  const { date } = dateForOffset(offset);
  const [meals, acts, prof] = await Promise.all([
    getMealsByDate(date),
    getActivitiesForDates([date]),
    getProfile(),
  ]);
  const totals = calcTotals(meals.flatMap((m) => m.items.map(dbItemToFoodItem)));
  return formatBalance(
    totals.calories,
    totals,
    acts,
    maintenance(prof as never),
    prof.targetDeficit,
    dayLabel(offset, date),
  );
}

async function sendBalance(chatId: string, offset = 0): Promise<void> {
  const prof = await getProfile();
  // Without stats there's no maintenance figure, so offer the quickest way to fix that.
  const buttons = maintenance(prof as never)
    ? undefined
    : [[{ text: "👤 Set up my stats", callback_data: "setup:start" }]];
  await reply(chatId, await balanceText(offset), buttons);
}

/** Which profile field the next plain message should answer. */
const AWAITING = "awaiting_profile_step";

async function askStep(chatId: string, step: Step): Promise<void> {
  await setState(AWAITING, step.id);
  await reply(chatId, step.question, step.buttons);
}

/** Ask the next unanswered question, or finish and show the result. */
async function advanceSetup(chatId: string, afterId?: Step["id"]): Promise<void> {
  const prof = await getProfile();
  const step = afterId ? stepAfter(afterId, prof) : nextStep(prof);
  if (step) {
    await askStep(chatId, step);
    return;
  }
  await clearState(AWAITING);
  const maint = maintenance(prof as never);
  await reply(
    chatId,
    maint
      ? `All set 🎉\n\n${formatProfile(prof, maint)}\n\nNow log a workout like "burnt 500 on an incline walk" and /balance will show your deficit.`
      : formatProfile(prof, null),
    MENU_BUTTONS,
  );
}

async function sendProfile(chatId: string): Promise<void> {
  const prof = await getProfile();
  const maint = maintenance(prof as never);
  if (!maint) {
    // Nothing useful to show yet — just start asking.
    await reply(chatId, "Let's work out your maintenance calories — six quick questions 👇");
    await advanceSetup(chatId);
    return;
  }
  await reply(chatId, formatProfile(prof, maint), [
    [{ text: "✏️ Update stats", callback_data: "setup:start" }],
  ]);
}

/**
 * A reply to a setup question. Returns false when it isn't one, so the message
 * falls through to normal routing — a user who ignores the question isn't stuck.
 */
async function handleSetupReply(chatId: string, text: string): Promise<boolean> {
  const pending = await getState(AWAITING);
  if (!pending) return false;
  const step = stepById(pending);
  if (!step || !step.range) return false;

  const n = parseNumber(text, step.range);
  if (n === null) {
    // Could be a number they fat-fingered, or they've moved on to something else.
    if (/\d/.test(text)) {
      await reply(chatId, `That doesn't look right — ${step.question}`);
      return true;
    }
    await clearState(AWAITING);
    return false;
  }
  await updateProfile({ [step.field]: valueForField(step, n) } as never);
  await advanceSetup(chatId, step.id);
  return true;
}

/** Button answers: setup:start, or setup:<field>:<value>. */
async function handleSetupCallback(chatId: string, data: string): Promise<void> {
  const [, field, value] = data.split(":");
  if (field === "start") {
    await reply(chatId, "Let's do it — six quick questions 👇");
    await advanceSetup(chatId);
    return;
  }
  if (field === "sex" && (value === "male" || value === "female")) {
    await updateProfile({ sex: value });
    await advanceSetup(chatId, "sex");
    return;
  }
  if (field === "activity") {
    await updateProfile({ activityLevel: value });
    await advanceSetup(chatId, "activity");
    return;
  }
  if (field === "target") {
    // "Skip" sends 0, which means no target rather than a zero-calorie one.
    await updateProfile({ targetDeficit: Number(value) || null });
    await advanceSetup(chatId, "target");
  }
}

async function undoLast(chatId: string): Promise<void> {
  const [last] = await getRecentMeals(1);
  if (!last) {
    await reply(chatId, "Nothing to undo — your log is empty.");
    return;
  }
  await deleteMeal(last.id);
  await reply(chatId, `Removed <b>${esc(last.aiSummary || last.description || last.mealType)}</b>.`);
}

async function handleCommand(chatId: string, cmd: string, username: string | null): Promise<boolean> {
  switch (cmd) {
    case "/start": {
      const owner = await claimChat(chatId, username);
      if (owner.chatId !== chatId) {
        await sendMessage(chatId, "This is a private bot 🙈");
        return true;
      }
      const prof = await getProfile();
      const needsSetup = !maintenance(prof as never);
      await reply(
        chatId,
        `Hey${username ? ` ${esc(username)}` : ""}! I'm your food journal 🥗\n\n${HELP}`,
        needsSetup
          ? [[{ text: "👤 Set up my stats first", callback_data: "setup:start" }], ...MENU_BUTTONS]
          : MENU_BUTTONS,
      );
      if (needsSetup) {
        await reply(
          chatId,
          "To track a deficit I need your maintenance calories. Tap the button above, or just tell me: \"male, 27, 178cm, 72kg, lightly active\".",
        );
      }
      return true;
    }
    case "/help":
      await reply(chatId, HELP, MENU_BUTTONS);
      return true;
    case "/menu":
      await reply(chatId, "What would you like to see?", MENU_BUTTONS);
      return true;
    case "/today":
      await sendDay(chatId, 0);
      return true;
    case "/yesterday":
      await sendDay(chatId, -1);
      return true;
    case "/week":
      await sendWeek(chatId);
      return true;
    case "/balance":
    case "/deficit":
      await sendBalance(chatId, 0);
      return true;
    case "/profile":
      await sendProfile(chatId);
      return true;
    case "/undo":
      await undoLast(chatId);
      return true;
    case "/reset":
      await clearTurns();
      await sendMessage(chatId, "Fresh start — I've forgotten our conversation. Your meal log is untouched.");
      return true;
    case "/unlink":
      await unlinkChat();
      await sendMessage(chatId, "Unlinked. Send /start to link this chat again.");
      return true;
    default:
      return false;
  }
}

async function handleCallback(chatId: string, data: string, messageId?: number): Promise<void> {
  if (data.startsWith("setup:")) {
    await handleSetupCallback(chatId, data);
    return;
  }
  if (data.startsWith("del:")) {
    await deleteMeal(data.slice(4));
    if (messageId) await editMessageText(chatId, messageId, "🗑 <i>Removed from your log.</i>");
    return;
  }
  if (data.startsWith("day:")) {
    await sendDay(chatId, Number(data.slice(4)) || 0);
    return;
  }
  if (data === "week") {
    await sendWeek(chatId);
    return;
  }
  if (data === "balance") {
    await sendBalance(chatId, 0);
    return;
  }
  if (data === "profile") {
    await sendProfile(chatId);
    return;
  }
  if (data === "undo") {
    await undoLast(chatId);
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
    await answerCallbackQuery(q.id);
    if (q.data) await handleCallback(chatId, q.data, q.message?.message_id);
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
    // The caption can carry both the food and when it was eaten.
    const routing = text ? await routeMessage(text, await getRecentTurns()) : null;
    await appendTurn("user", text ? `[photo] ${text}` : "[photo]");
    try {
      const imageDataUrl = await fetchPhotoDataUrl(pickPhoto(msg.photo));
      await logMeal(chatId, {
        imageDataUrl,
        description: text || undefined,
        dayOffset: routing?.dayOffset ?? 0,
        mealType: routing?.mealType ?? null,
      });
    } catch (err) {
      console.error("telegram photo failed:", err);
      await reply(chatId, "I couldn't download that photo — mind sending it again?");
    }
    await pruneTurns();
    return;
  }

  if (!text) return;

  // A pending setup question owns the next message — answering "72" shouldn't be
  // sent to the food model.
  if (await handleSetupReply(chatId, text)) {
    await appendTurn("user", text);
    return;
  }

  await sendChatAction(chatId);
  const history = await getRecentTurns();
  await appendTurn("user", text);
  const routing = await routeMessage(text, history);

  if (routing.intent === "log_meal") {
    await logMeal(chatId, {
      description: text,
      dayOffset: routing.dayOffset,
      mealType: routing.mealType,
    });
  } else if (routing.intent === "log_activity") {
    await logActivity(
      chatId,
      routing.activity || "Workout",
      routing.burnedCalories,
      routing.dayOffset,
    );
  } else if (routing.intent === "set_profile" && routing.profile) {
    await applyProfile(chatId, routing.profile);
  } else if (routing.intent === "amend_date") {
    await amendDate(chatId, routing.dayOffset);
  } else {
    await handleConversation(chatId, text, history);
  }
  await pruneTurns();
}

async function isOwner(chatId: string): Promise<boolean> {
  const owner = await getLinkedChat();
  return !!owner && owner.chatId === chatId;
}
