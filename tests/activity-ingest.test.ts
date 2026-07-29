/**
 * The /api/activity endpoint is what Apple Shortcuts (and anything else) posts to.
 * A repeating automation will re-send the same workout, so dedupe has to hold.
 */
import fs from "node:fs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const DB_FILE = "test-activity.db";
process.env.DATABASE_URL = `file:${DB_FILE}`;
process.env.DATABASE_AUTH_TOKEN = "";
process.env.APP_TIMEZONE = "Asia/Singapore";
process.env.CRON_SECRET = "test-secret";

let POST: typeof import("@/app/api/activity/route").POST;
let getActivitiesForDates: typeof import("@/lib/db/queries").getActivitiesForDates;
let todayString: typeof import("@/lib/dates").todayString;

function post(body: unknown, auth?: string) {
  return new Request("http://localhost/api/activity", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

const OK = "Bearer test-secret";

beforeAll(async () => {
  for (const f of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  const { createClient } = await import("@libsql/client");
  await createClient({ url: `file:${DB_FILE}` }).execute(
    `CREATE TABLE activities (id TEXT PRIMARY KEY, source TEXT NOT NULL, external_id TEXT UNIQUE,
     description TEXT NOT NULL, calories REAL NOT NULL, logged_at INTEGER NOT NULL, logged_date TEXT NOT NULL)`,
  );
  ({ POST } = await import("@/app/api/activity/route"));
  ({ getActivitiesForDates } = await import("@/lib/db/queries"));
  ({ todayString } = await import("@/lib/dates"));
});

beforeEach(async () => {
  const { createClient } = await import("@libsql/client");
  await createClient({ url: `file:${DB_FILE}` }).execute("DELETE FROM activities");
});

describe("POST /api/activity", () => {
  it("rejects a request without the secret", async () => {
    expect((await POST(post({ calories: 100 }))).status).toBe(401);
    expect((await POST(post({ calories: 100 }, "Bearer wrong"))).status).toBe(401);
  });

  it("stores a workout and reports the day's burn", async () => {
    const res = await POST(post({ description: "Incline walk", calories: 520 }, OK));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.burnedThatDay).toBe(520);

    const rows = await getActivitiesForDates([todayString("Asia/Singapore")]);
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe("Incline walk");
    expect(rows[0].source).toBe("shortcuts");
  });

  it("ignores a re-sent workout with the same externalId", async () => {
    const body = { description: "Incline walk", calories: 520, externalId: "health-2026-07-30" };
    await POST(post(body, OK));
    const second = await POST(post(body, OK));
    expect((await second.json()).duplicate).toBe(true);
    expect(await getActivitiesForDates([todayString("Asia/Singapore")])).toHaveLength(1);
  });

  it("accumulates separate workouts on the same day", async () => {
    await POST(post({ description: "Walk", calories: 300, externalId: "a" }, OK));
    const res = await POST(post({ description: "Gym", calories: 250, externalId: "b" }, OK));
    expect((await res.json()).burnedThatDay).toBe(550);
  });

  it("honours an explicit timestamp for back-dating", async () => {
    const at = Date.now() - 86_400_000;
    const res = await POST(post({ description: "Run", calories: 400, at }, OK));
    const body = await res.json();
    expect(body.date).not.toBe(todayString("Asia/Singapore"));
  });

  it("rejects a bad payload", async () => {
    expect((await POST(post({}, OK))).status).toBe(400);
    expect((await POST(post({ calories: -5 }, OK))).status).toBe(400);
    expect((await POST(post({ calories: 500, at: "not-a-date" }, OK))).status).toBe(400);
  });
});
