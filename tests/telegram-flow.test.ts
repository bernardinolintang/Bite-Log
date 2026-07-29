/**
 * Drives the bot end to end against a throwaway SQLite file, with the Telegram
 * transport and the model both stubbed. Proves the routing, persistence and reply
 * wiring work without touching the network.
 */
import fs from "node:fs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const DB_FILE = "test-telegram.db";
process.env.DATABASE_URL = `file:${DB_FILE}`;
process.env.DATABASE_AUTH_TOKEN = "";
process.env.APP_TIMEZONE = "Asia/Singapore";
process.env.GROQ_API_KEY = "test-key";

const sent: { chatId: string; text: string; buttons?: unknown }[] = [];

vi.mock("@/lib/telegram/api", () => ({
  sendMessage: vi.fn(async (chatId: string, text: string, buttons?: unknown) => {
    sent.push({ chatId, text, buttons });
  }),
  sendChatAction: vi.fn(async () => {}),
  answerCallbackQuery: vi.fn(async () => {}),
  editMessageText: vi.fn(async () => {}),
  fetchPhotoDataUrl: vi.fn(async () => "data:image/jpeg;base64,AAAA"),
  esc: (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
}));

const analyzeMeal = vi.fn();
const classifyIntent = vi.fn();
const answerQuestion = vi.fn();

vi.mock("@/lib/ai/analyze", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/analyze")>();
  return { ...actual, analyzeMeal: (...a: unknown[]) => analyzeMeal(...a) };
});
vi.mock("@/lib/telegram/agent", () => ({
  classifyIntent: (...a: unknown[]) => classifyIntent(...a),
  answerQuestion: (...a: unknown[]) => answerQuestion(...a),
}));

const OWNER = "12345";
const STRANGER = "99999";

function textUpdate(chatId: string, text: string) {
  return { message: { message_id: 1, chat: { id: chatId }, from: { username: "bernard" }, text } };
}

const toastAnalysis = {
  meal_summary: "Toast and eggs",
  no_food: false,
  clarification_questions: [],
  items: [
    {
      food_name: "Toast",
      quantity_desc: "2 slices",
      grams: 60,
      calories: 160,
      protein_g: 6,
      carbs_g: 30,
      fat_g: 2,
      fibre_g: 2,
      sodium_mg: 250,
      confidence: 0.9,
      assumptions: [],
    },
  ],
};

let handleUpdate: typeof import("@/lib/telegram/handle").handleUpdate;
let getRecentMeals: typeof import("@/lib/db/queries").getRecentMeals;

beforeAll(async () => {
  for (const f of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  const { createClient } = await import("@libsql/client");
  const client = createClient({ url: `file:${DB_FILE}` });
  // Mirror the drizzle schema for the tables this flow touches.
  await client.batch([
    `CREATE TABLE meals (id TEXT PRIMARY KEY, meal_type TEXT NOT NULL, input_type TEXT NOT NULL,
      description TEXT, thumbnail TEXT, ai_summary TEXT, logged_at INTEGER NOT NULL, logged_date TEXT NOT NULL)`,
    `CREATE TABLE meal_items (id TEXT PRIMARY KEY, meal_id TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
      food_name TEXT NOT NULL, quantity_desc TEXT NOT NULL, grams REAL, calories REAL NOT NULL,
      protein_g REAL NOT NULL, carbs_g REAL NOT NULL, fat_g REAL NOT NULL, fibre_g REAL, sodium_mg REAL,
      confidence REAL NOT NULL, assumptions TEXT NOT NULL DEFAULT '[]')`,
    `CREATE TABLE settings (id INTEGER PRIMARY KEY, calorie_target REAL, protein_target REAL, carbs_target REAL, fat_target REAL)`,
    `CREATE TABLE food_templates (id TEXT PRIMARY KEY, food_key TEXT NOT NULL UNIQUE, food_name TEXT NOT NULL,
      quantity_desc TEXT NOT NULL, grams REAL, calories REAL NOT NULL, protein_g REAL NOT NULL, carbs_g REAL NOT NULL,
      fat_g REAL NOT NULL, fibre_g REAL, sodium_mg REAL, use_count INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL)`,
    `CREATE TABLE saved_meals (id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL UNIQUE, label TEXT NOT NULL,
      meal_type TEXT NOT NULL, thumbnail TEXT, items_json TEXT NOT NULL, log_count INTEGER NOT NULL DEFAULT 1,
      last_logged_at INTEGER NOT NULL)`,
    `CREATE TABLE telegram_chats (id INTEGER PRIMARY KEY, chat_id TEXT NOT NULL, username TEXT, linked_at INTEGER NOT NULL)`,
    `CREATE TABLE checkins (id TEXT PRIMARY KEY, slot TEXT NOT NULL, sent_at INTEGER NOT NULL)`,
  ]);
  ({ handleUpdate } = await import("@/lib/telegram/handle"));
  ({ getRecentMeals } = await import("@/lib/db/queries"));
});

beforeEach(() => {
  sent.length = 0;
  analyzeMeal.mockReset();
  classifyIntent.mockReset();
  answerQuestion.mockReset();
});

describe("telegram bot flow", () => {
  it("links the first chat that sends /start", async () => {
    await handleUpdate(textUpdate(OWNER, "/start"));
    expect(sent).toHaveLength(1);
    expect(sent[0].chatId).toBe(OWNER);
    expect(sent[0].text).toContain("food journal");
  });

  it("ignores everyone else once linked", async () => {
    await handleUpdate(textUpdate(STRANGER, "chicken rice"));
    expect(sent).toHaveLength(0);
    await handleUpdate(textUpdate(STRANGER, "/today"));
    expect(sent).toHaveLength(0);
  });

  it("tells a stranger the bot is private when they try to claim it", async () => {
    await handleUpdate(textUpdate(STRANGER, "/start"));
    expect(sent[0].text).toContain("private bot");
  });

  it("logs a described meal and offers an undo button", async () => {
    classifyIntent.mockResolvedValue("log_meal");
    analyzeMeal.mockResolvedValue(toastAnalysis);
    await handleUpdate(textUpdate(OWNER, "two slices of toast"));

    expect(analyzeMeal).toHaveBeenCalledOnce();
    expect(sent[0].text).toContain("Toast and eggs");
    expect(sent[0].text).toContain("160");
    expect(JSON.stringify(sent[0].buttons)).toContain("del:");

    const [meal] = await getRecentMeals(1);
    expect(meal.aiSummary).toBe("Toast and eggs");
    expect(meal.items).toHaveLength(1);
  });

  it("answers a question instead of logging it", async () => {
    classifyIntent.mockResolvedValue("question");
    answerQuestion.mockResolvedValue("You've had 160 kcal so far today.");
    await handleUpdate(textUpdate(OWNER, "how many calories so far?"));

    expect(analyzeMeal).not.toHaveBeenCalled();
    expect(answerQuestion).toHaveBeenCalledOnce();
    expect(sent[0].text).toContain("160 kcal so far");
  });

  it("shows the day's log for /today", async () => {
    await handleUpdate(textUpdate(OWNER, "/today"));
    expect(sent[0].text).toContain("Toast and eggs");
    expect(sent[0].text).toContain("Total");
  });

  it("refuses to invent food when the model reports none", async () => {
    classifyIntent.mockResolvedValue("log_meal");
    analyzeMeal.mockResolvedValue({
      meal_summary: "",
      no_food: true,
      items: [],
      clarification_questions: [],
    });
    const before = (await getRecentMeals(50)).length;
    await handleUpdate(textUpdate(OWNER, "my car keys"));
    expect(sent[0].text).toContain("doesn't look like food");
    expect((await getRecentMeals(50)).length).toBe(before);
  });

  it("logs a photo, using the caption as extra context", async () => {
    analyzeMeal.mockResolvedValue(toastAnalysis);
    await handleUpdate({
      message: {
        message_id: 2,
        chat: { id: OWNER },
        caption: "no butter",
        photo: [
          { file_id: "small", width: 90, file_size: 1000 },
          { file_id: "big", width: 1280, file_size: 200_000 },
        ],
      },
    });
    expect(analyzeMeal).toHaveBeenCalledWith(
      expect.objectContaining({ description: "no butter", imageDataUrl: expect.stringContaining("data:image") }),
    );
    expect(sent[0].text).toContain("Toast and eggs");
  });

  it("removes the meal behind an undo button", async () => {
    const [meal] = await getRecentMeals(1);
    await handleUpdate({
      callback_query: {
        id: "cb1",
        data: `del:${meal.id}`,
        message: { message_id: 5, chat: { id: OWNER } },
      },
    });
    const after = await getRecentMeals(1);
    expect(after[0]?.id).not.toBe(meal.id);
  });

  it("undoes the last meal with /undo", async () => {
    const before = await getRecentMeals(50);
    await handleUpdate(textUpdate(OWNER, "/undo"));
    expect(sent[0].text).toContain("Removed");
    expect((await getRecentMeals(50)).length).toBe(before.length - 1);
  });

  it("keeps logging when intent classification fails open", async () => {
    classifyIntent.mockResolvedValue("log_meal");
    analyzeMeal.mockRejectedValue(new Error("groq down"));
    await handleUpdate(textUpdate(OWNER, "nasi lemak"));
    expect(sent[0].text).toContain("couldn't read that one");
  });
});
