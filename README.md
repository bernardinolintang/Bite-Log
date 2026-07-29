# 🥗 BiteLog

Personal AI meal logger: snap a photo or describe a meal → an AI vision model estimates
calories and macros → edit anything → save to your daily log. Built to deploy on Vercel.
All numbers are estimates for awareness — not medical advice.

## Stack

Next.js (App Router) · Tailwind CSS · Drizzle ORM + libSQL (local file in dev, Turso in prod) ·
Groq API (OpenAI-compatible vision model) · Zod · Vitest

## The AI model

`GROQ_MODEL` **must name a model that accepts image input** — check the `input_modalities`
field at https://console.groq.com/docs/models. Groq retires models regularly; when photo
analysis starts failing with a 404, this is why. Pick a current vision model and update
`GROQ_MODEL` (the default lives in `DEFAULT_GROQ_MODEL` in `src/lib/ai/analyze.ts`).

Reasoning is explicitly disabled on the request. These models otherwise spend their token
budget "thinking", which truncates the JSON reply and makes a photo take ~35s instead of ~2s.

Groq's free tier allows 8,000 tokens/minute and a photo costs ~2,000, so roughly four photo
analyses per minute. Past that the app shows a "wait about a minute" message.

## Local setup

1. `npm install`
2. `cp .env.example .env` and fill in:
   - `GROQ_API_KEY` — from https://console.groq.com/keys (free tier works)
3. `npm run db:push` — creates `local.db`
4. `npm run dev` — open http://localhost:3000

To use it from your phone on the same Wi-Fi: `npm run dev -- -H 0.0.0.0` and open
`http://<your-pc-ip>:3000` (camera capture requires HTTPS on some browsers — the deployed
Vercel version has HTTPS and always works).

## Tests

`npm test`

## Deploy (Vercel + Turso)

1. Push this repo to GitHub.
2. Create a Turso database (https://turso.tech, free tier):
   - `turso db create bitelog`
   - `turso db show bitelog --url` → `DATABASE_URL`
   - `turso db tokens create bitelog` → `DATABASE_AUTH_TOKEN`
3. Apply the schema to Turso: temporarily set both values in `.env`, run `npm run db:push`,
   then restore `DATABASE_URL=file:local.db` for local dev.
4. Import the repo at https://vercel.com/new and set env vars:
   `GROQ_API_KEY`, `GROQ_MODEL`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `APP_TIMEZONE`
   (plus the Telegram ones below, if you want the bot)
5. Deploy. On your phone, open the URL and "Add to Home Screen" to install it like an app.

If the deployment URL is public, anyone who finds it can use the app. For a personal deployment,
consider keeping the Vercel URL private or enabling [Vercel Deployment Protection](https://vercel.com/docs/security/deployment-protection).

> **Note:** Deployment Protection also blocks Telegram's webhook calls. If you turn it on,
> add `/api/telegram/*` as a public path, or the bot will go silent.

## Telegram bot

The bot is a nutrition assistant in your DMs: send a meal photo and it logs the breakdown,
ask it questions about your day, and it checks in around mealtimes. It writes to the same
database as the web app, so both stay in sync.

### Setup

1. **Create the bot.** In Telegram, message [@BotFather](https://t.me/BotFather) → `/newbot`
   → pick a display name and a username ending in `bot`. He replies with a token.
2. **Paste the token** into `.env` as `TELEGRAM_BOT_TOKEN`, and set `PUBLIC_URL` to your
   deployed https URL. `TELEGRAM_WEBHOOK_SECRET` and `CRON_SECRET` are already filled in.
3. **Add all four** to Vercel's env vars and redeploy.
4. **Register the webhook:** `npm run telegram:setup`
5. **Send `/start`** to your bot. The first chat to do this claims the bot; everyone else is
   ignored. `/unlink` releases it.

### Check-ins

Times live in `SLOTS` in [`src/lib/telegram/schedule.ts`](src/lib/telegram/schedule.ts) —
09:00 breakfast, 12:30 lunch, 19:00 dinner, 21:30 wrap-up, local to `APP_TIMEZONE`. Edit that
array to change them; nothing else needs updating.

The bot **skips a check-in if that meal is already logged**, so it only nags when it's useful.

`.github/workflows/checkin.yml` drives the schedule from GitHub Actions (free, and it can run
more than twice a day, unlike Vercel's Hobby cron). Add two repository secrets under
**Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `APP_URL` | your deployed https URL |
| `CRON_SECRET` | same value as in `.env` |

The endpoint works out which slot is due from the current time rather than trusting the caller,
and accepts a slot for 100 minutes after its time — so a late or repeated Actions run still
does the right thing, and can never send the same check-in twice.

To test one by hand: Actions → "Meal check-ins" → Run workflow.

### Calorie deficit

Tell the bot your stats once — "I'm male, 27, 178cm, 72kg, lightly active" — and it works out
your maintenance calories with the Mifflin-St Jeor equation. `/balance` then shows the day's
energy: eaten, burned, maintenance, and whether you're in deficit or surplus.

Pick the activity level that describes your day **without** deliberate exercise. Logged
workouts are added on top, so choosing "very active" *and* logging every gym session counts
the same effort twice.

Log workouts by telling the bot: *"burnt about 500 calories on an incline walk"*.

### Getting calories burned in automatically

`POST /api/activity` accepts burned calories from anything that can send JSON:

```bash
curl -X POST "$APP_URL/api/activity" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"description":"Incline walk","calories":520,"externalId":"health-2026-07-30"}'
```

Send an `externalId` and re-posting the same workout is a no-op, so a repeating automation is
safe to run as often as you like.

**Apple Health** has no cloud API — HealthKit data never leaves the device on its own. The way
in is an iOS Shortcut:

1. Shortcuts app → Automation → **Time of Day**, e.g. 22:00 daily
2. **Find Health Samples** → Active Energy → today → Sum
3. **Get Contents of URL** → your `$APP_URL/api/activity`, method POST,
   header `Authorization: Bearer <CRON_SECRET>`, JSON body with `calories` set to the sum
   from step 2 and `externalId` set to something like `health-` plus today's date

**Strava** does have a proper API (OAuth + activity webhooks) and could push workouts here
automatically — it just isn't built yet.

**Hevy** exposes an API on its paid tier. **Strong** has no API at all; it only exports CSV.
For both, telling the bot what you burned is the practical route.

### What it understands

| You send | It does |
| --- | --- |
| a meal photo (caption optional) | analyses it, logs it, shows the breakdown with an Undo button |
| "chicken rice and iced milo" | same, from the text |
| "that was yesterday's dinner" | logs or moves it to the right day |
| "burnt 500 calories on incline walks" | logs the workout and updates the deficit |
| "I'm male, 27, 178cm, 72kg, lightly active" | saves your stats and works out maintenance |
| "am I in a deficit?" | answers from food, workouts and maintenance together |
| `/menu` | buttons: Today, Yesterday, Deficit, 7 days, Profile, Undo |
| `/balance` | today's energy in and out |
| `/week` | 7 days with per-day macros |
| `/undo` | removes the last meal |

Free-text messages are routed by a classifier (log a meal vs. ask a question vs. small talk);
it falls back to logging, which is the common case.

## Notes

- Meal photos are compressed in the browser, analyzed once, and discarded — only a small
  thumbnail is stored in the database.
- If AI analysis fails (or `GROQ_API_KEY` is empty), manual entry still works.
