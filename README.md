# 🥗 BiteLog

**A personal calorie-deficit tracker you talk to in Telegram.**

Send a photo of your meal and BiteLog identifies every item, estimates calories and macros,
and logs it. Tell it what you burned at the gym and it works out whether you're in a deficit.
Ask it questions in plain English — *"am I in a deficit?"*, *"what did I eat yesterday?"* —
and it answers from your actual log.

There's also a web dashboard, but the bot is the main way in: it lives in your pocket and
checks in at mealtimes, so logging takes about five seconds.

> All numbers are **estimates for personal awareness** — not medical advice. Maintenance
> calories come from a formula, and app-reported exercise burn tends to run high. Trust the
> scale over the arithmetic.

---

## Contents

- [What it does](#what-it-does)
- [User guide](#user-guide) ← **start here**
- [Correcting mistakes](#correcting-mistakes)
- [Calorie deficit](#calorie-deficit)
- [Automatic exercise import](#automatic-exercise-import)
- [Setup](#setup)
- [How it works](#how-it-works)
- [Troubleshooting](#troubleshooting)

---

## What it does

| | |
| --- | --- |
| 📸 **Photo → nutrition** | Per-item breakdown with calories, protein, carbs, fat, and a confidence score |
| ✍️ **Text logging** | *"chicken rice and iced milo"* works just as well as a photo |
| ✏️ **Corrections** | *"that's french toast, not kaya"* → it re-estimates the whole meal |
| 🔥 **Exercise** | *"burnt 500 on an incline walk"*, or import from Apple Health automatically |
| ⚡️ **Deficit tracking** | Maintenance calories from your stats, minus what you ate, plus what you burned |
| 💬 **Conversation** | Remembers the thread, so follow-ups like *"was that a lot of fat?"* work |
| ⏰ **Mealtime check-ins** | Nudges at breakfast, lunch, dinner — and stays quiet if you already logged |
| 🧠 **Food memory** | Once you correct a food, it remembers your numbers for next time |
| 📱 **Web dashboard** | Installable PWA for browsing history and editing entries |

---

## User guide

### First run

Message your bot and send `/start`. The first chat to do this claims the bot; everyone else
is ignored, so it's safe if someone finds the username.

It'll offer to set up your stats. Tap **👤 Set up my stats** and answer six quick questions:

```
BiteLog  First up — what should I use for the calculation?
         [ Male ]  [ Female ]
BiteLog  How old are you? (just the number)
You      27
BiteLog  Your height in cm? (e.g. 178)
You      178cm
BiteLog  And your weight in kg? (e.g. 72)
You      72 kg
BiteLog  How active is a normal day, not counting workouts?
         [ sedentary — Desk job, little walking ]
         [ light — On your feet a bit, light walking ]  …
BiteLog  Last one — how big a daily deficit are you aiming for?
         [ 300 (slow) ] [ 500 (steady) ] [ 750 (fast) ] [ Skip ]
BiteLog  All set 🎉  Maintenance: 2288 kcal/day before exercise
```

Prefer one message? Just type it: *"male, 27, 178cm, 72kg, lightly active"*. Same result.

> **Pick the activity level that describes your day _without_ deliberate exercise.**
> Workouts you log are added on top. Choosing "very active" *and* logging every gym session
> counts the same effort twice — that's how people end up thinking they have 800 more
> calories to spend than they do.

### Logging a meal

**Send a photo.** Caption optional. About two seconds later — **nothing is saved yet**:

```
👀 Kaya toast with soft-boiled egg and coffee — does this look right?

• Kaya Toast 2 slices — 360 kcal
• Soft-boiled Egg 2 eggs — 155 kcal
• Coffee (Kopi) 1 cup — 120 kcal

635 kcal · P 19g C 66g F 33g
Would bring today to 990 kcal
        [ ✅ Log it ]  [ 🗑 Discard ]
```

**Tap ✅ Log it** and it's saved — now with **✏️ Fix this** and **🗑 Undo** in case something
still slipped through:

```
✅ Logged.

🍳 Kaya toast with soft-boiled egg and coffee

• Kaya Toast 2 slices — 360 kcal
• Soft-boiled Egg 2 eggs — 155 kcal
• Coffee (Kopi) 1 cup — 120 kcal

635 kcal · P 19g C 66g F 33g
Today so far: 990 kcal
        [ ✏️ Fix this ]  [ 🗑 Undo ]
        [ ⚡️ Deficit ]
```

**Or just say what's wrong** before confirming — *"no crab stick"*, *"that's french toast not
kaya"*, *"3 slices not 2"* — and it redoes the analysis and shows you the updated preview
again, still unsaved, as many rounds as you need. Nothing hits your log until you confirm it.

**Or type the meal instead of a photo** — *"chicken rice and iced milo"*, *"just a flat
white"* — same preview-first flow either way.

**Back-date it** by saying so: *"that was yesterday's dinner"* logs it under yesterday.
Already logged and on the wrong day? *"I told you that was yesterday"* moves it.

### Logging exercise

Tell it what you burned: *"burnt about 500 calories on an incline walk"*, *"ran 5k, watch
said 380"*. It logs it and immediately shows your updated deficit.

No number? It asks rather than guessing — your watch or app knows better than a formula.

### Asking questions

Just talk to it. It reads your last 7 days of food and workouts:

- *"how many calories so far?"*
- *"what did I eat yesterday?"*
- *"am I in a deficit today?"*
- *"how much more can I eat today?"*
- *"how am I doing on protein?"*
- *"was that a lot of fat?"* — follow-ups work, it remembers the thread

### Commands

| Command | What it shows |
| --- | --- |
| `/menu` | Buttons for everything below |
| `/balance` | Today's energy: eaten, burned, maintenance, deficit |
| `/today` | Today's meals and totals |
| `/yesterday` | Yesterday's log |
| `/week` | 7 days, per-day macros and averages |
| `/profile` | Your stats and maintenance calories |
| `/undo` | Remove the last thing logged |
| `/reset` | Forget the conversation (your food log is untouched) |
| `/help` | Quick reference |
| `/unlink` | Release the bot so another chat can claim it |

### Check-ins

The bot messages you around **09:00, 12:30, 19:00** and sends a **21:30** wrap-up.

It **skips a check-in if you've already logged that meal**, so it only speaks when it's
useful. Times live in `SLOTS` in [`src/lib/telegram/schedule.ts`](src/lib/telegram/schedule.ts) —
edit that array and nothing else needs changing.

---

## Correcting mistakes

The AI gets things wrong — it once claimed a photo of chicken rice included a crab stick that
was never there. Two situations, two ways to fix it, both **in place** — the meal keeps its
date and position in your log, nothing gets duplicated.

**Still in the preview, not logged yet?** Just say what's wrong — see [Logging a
meal](#logging-a-meal) above. It updates the same preview; still nothing saved until you tap
✅ Log it.

**Already logged — from earlier, or you tapped ✅ Log it before noticing?** Tap **✏️ Fix
this** under that meal, then say what was wrong. Or just say it directly, without tapping
anything first — the bot understands that you're disputing its last breakdown rather than
describing a new meal:

| You say | What happens |
| --- | --- |
| *"that's french toast, not kaya toast"* | Swaps the item, recalculates |
| *"there were 3 slices not 2"* | Scales the portion |
| *"the kopi was kopi-o kosong"* | 120 kcal → 5 kcal |
| *"you missed the butter"* | Adds it |
| *"no egg, I didn't have that"* | Removes it |
| *"wrong"* | Asks what to change |

It re-estimates the **whole meal**, keeping the items you didn't dispute, and treats your
word as authoritative — you were there and the model wasn't.

Corrected foods are also remembered: log that food again and your numbers are used instead
of a fresh guess.

If the entry is beyond saving, **🗑 Undo** deletes it outright.

---

## Calorie deficit

`/balance` puts food and exercise together:

```
Today — energy

🍽 Eaten        975 kcal
   P 30g · C 47g · F 72g

🔥 Burned       520 kcal
   Incline walk — 520

⚡️ Maintenance 2288 kcal (before exercise)
   Total out   2808 kcal

✅ 1833 kcal deficit
At this rate: −1.67 kg/week
Target was 500 — you're 1333 past it.
```

Maintenance uses the **Mifflin-St Jeor** equation (BMR from sex, age, height, weight) times
an activity multiplier. Logged workouts are added on top of that baseline.

Weekly rate assumes 7,700 kcal ≈ 1 kg of body fat. Treat it as a projection, not a promise:
formula-based maintenance carries roughly ±10–15% error. If the scale disagrees with the
arithmetic over 2–3 weeks, believe the scale and adjust your activity level.

---

## Automatic exercise import

`POST /api/activity` accepts burned calories from anything that can send JSON:

```bash
curl -X POST "$APP_URL/api/activity" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"description":"Incline walk","calories":520,"externalId":"health-2026-07-30"}'
```

| Field | |
| --- | --- |
| `calories` | **required**, the number burned |
| `description` | label shown in the log (default `"Workout"`) |
| `at` | ISO string or epoch ms (default now) — use it to back-date |
| `externalId` | send one and re-posting the same workout is a **no-op**, so a repeating automation is safe |
| `source` | free-form tag (default `"shortcuts"`) |

### Apple Health (iOS Shortcut)

Apple Health has **no cloud API** — HealthKit data never leaves the device on its own. The
way in is a Shortcuts automation:

1. **Shortcuts → Automation → Time of Day**, e.g. 22:00 daily
2. **Find Health Samples** → Active Energy → today → **Sum**
3. **Get Contents of URL** → `https://<your-app>/api/activity`
   - Method **POST**
   - Header `Authorization: Bearer <CRON_SECRET>`
   - JSON body: `calories` = the sum from step 2, `externalId` = `health-` + today's date

The `externalId` means running it more than once a day is harmless.

### Other apps

| App | Status |
| --- | --- |
| **Strava** | Has a proper OAuth + webhook API and could push workouts in automatically. **Not built yet.** |
| **Hevy** | API is available on the paid tier only. |
| **Strong** | No API at all — CSV export only. |

For anything unsupported, telling the bot what you burned takes five seconds.

---

## Setup

### 1. Local

```bash
npm install
cp .env.example .env     # fill in GROQ_API_KEY
npm run db:push          # creates local.db
npm run dev              # http://localhost:3000
```

`GROQ_API_KEY` comes from https://console.groq.com/keys — the free tier is enough.

### 2. Deploy (Vercel + Turso)

1. Push to GitHub.
2. Create a Turso database (free tier):
   ```bash
   turso db create bitelog
   turso db show bitelog --url        # → DATABASE_URL
   turso db tokens create bitelog     # → DATABASE_AUTH_TOKEN
   ```
3. Apply the schema: put both values in `.env`, run `npm run db:push`, then restore
   `DATABASE_URL=file:local.db` for local dev.
4. Import at https://vercel.com/new and set the env vars below.
5. Deploy. On your phone, open the URL and **Add to Home Screen**.

| Env var | |
| --- | --- |
| `GROQ_API_KEY` | Groq API key |
| `GROQ_MODEL` | a **vision-capable** model (see [How it works](#how-it-works)) |
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | Turso |
| `APP_TIMEZONE` | day boundaries and check-in times, e.g. `Asia/Singapore` |
| `TELEGRAM_BOT_TOKEN` | from @BotFather |
| `PUBLIC_URL` | your deployed https URL, no trailing slash |
| `TELEGRAM_WEBHOOK_SECRET` | any long random string |
| `CRON_SECRET` | any long random string |

> ⚠️ Vercel **Deployment Protection** also blocks Telegram's webhook calls. If you enable it,
> allow `/api/telegram/*` publicly or the bot goes silent.

### 3. Telegram bot

1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → pick a name and a username
   ending in `bot`. Copy the token.
2. Put it in `.env` as `TELEGRAM_BOT_TOKEN`, set `PUBLIC_URL` to your deployed URL.
3. Add all four Telegram vars to Vercel and redeploy.
4. `npm run telegram:setup` — registers the webhook and the command menu.
5. Send `/start` to your bot.

Re-run `npm run telegram:setup` whenever the command list changes or you redeploy to a new URL.

### 4. Check-in schedule

Check-ins run from GitHub Actions ([`.github/workflows/checkin.yml`](.github/workflows/checkin.yml)),
because Vercel's Hobby plan caps cron at two runs a day and we need four.

Add two repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `APP_URL` | your deployed https URL |
| `CRON_SECRET` | same value as in `.env` |

Test it by hand: **Actions → Meal check-ins → Run workflow**. A response of
`{"sent":false,"reason":"no slot due"}` means the plumbing works and it simply isn't
mealtime.

---

## How it works

```
Telegram ──► /api/telegram/webhook ──► router (intent) ──┬─► vision model ──► meal log
                                                          ├─► activity log
                                                          ├─► profile
                                                          └─► conversation (log as context)

GitHub Actions ──► /api/telegram/checkin ──► "had lunch yet?"
iOS Shortcut  ──► /api/activity          ──► exercise log
Browser       ──► Next.js dashboard      ──► same database
```

**Stack:** Next.js (App Router) · Tailwind · Drizzle ORM + libSQL/Turso · Groq
(OpenAI-compatible) · Zod · Vitest

### The AI model

`GROQ_MODEL` **must accept image input** — check `input_modalities` at
https://console.groq.com/docs/models. Groq retires models regularly; a sudden 404 on every
photo is why. The default lives in `DEFAULT_GROQ_MODEL` in
[`src/lib/ai/analyze.ts`](src/lib/ai/analyze.ts).

**Reasoning is deliberately disabled.** These models otherwise spend their completion budget
"thinking", which truncates the JSON mid-object and makes a photo take ~35s instead of ~1.2s.

Groq's free tier allows 8,000 tokens/minute; a photo costs ~2,000, so about four photo
analyses per minute. Past that the bot says to wait a minute.

### Design notes

- **The webhook always returns 200.** Telegram retries non-200 responses with the same
  update, which would double-log a meal.
- **Check-in slots are claimed via a primary key** before sending, so overlapping scheduler
  runs can't both fire. A slot stays valid for 100 minutes so a late Actions run still works.
- **The bot derives the due slot from the current time** rather than trusting the caller.
- **Photos aren't stored** from Telegram — corrections re-estimate from the previous
  breakdown plus your words, which is why your correction is treated as authoritative.
- **Only one chat can use the bot**, claimed by the first `/start`.

### Tests

```bash
npm test        # 112 tests
```

Energy maths is checked against known Mifflin-St Jeor values. The bot flow runs end-to-end
against a throwaway SQLite file with the Telegram transport and model stubbed, covering
linking, stranger rejection, logging, corrections, back-dating, guided setup, and undo.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| **Bot silent** | Check `curl -s https://api.telegram.org/bot<TOKEN>/getWebhookInfo`. A `last_error_message` of 404 means `PUBLIC_URL` was wrong when you ran setup, or the code isn't deployed. |
| **Every photo fails** | `GROQ_MODEL` names a retired or text-only model. Check `input_modalities` in Groq's model list. |
| **"Too many photos"** | Free-tier rate limit — ~4 photos/minute. Wait a minute. |
| **No check-ins** | GitHub Actions secrets `APP_URL` / `CRON_SECRET` missing, or the meal was already logged (by design). |
| **Deficit says stats unknown** | Run `/profile`. |
| **Numbers look wrong** | Correct it — *"3 slices not 2"*. It learns that food for next time. |
| **Local build runs out of memory** | Delete `.next` and retry. |

---

## Privacy

Single-user by design. The bot answers one Telegram chat and ignores everything else.
Meal photos sent to Telegram are analyzed and discarded — not stored in the database.
Photos uploaded through the web app keep a small thumbnail only. Your food log lives in your
own Turso database; meal text and photos are sent to Groq for analysis.
