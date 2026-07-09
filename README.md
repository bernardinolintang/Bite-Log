# 🥗 BiteLog

Personal AI meal logger: snap a photo or describe a meal → an AI vision model estimates
calories and macros → edit anything → save to your daily log. Single user, password-gated,
built to deploy on Vercel. All numbers are estimates for awareness — not medical advice.

## Stack

Next.js (App Router) · Tailwind CSS · Drizzle ORM + libSQL (local file in dev, Turso in prod) ·
Groq API (OpenAI-compatible, Llama 4 vision) · Zod · jose · Vitest

## Local setup

1. `npm install`
2. `cp .env.example .env` and fill in:
   - `GROQ_API_KEY` — from https://console.groq.com/keys (free tier works)
   - `APP_PASSWORD` — the password you'll log in with
   - `SESSION_SECRET` — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
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
   `GROQ_API_KEY`, `GROQ_MODEL`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`,
   `APP_PASSWORD`, `SESSION_SECRET`, `APP_TIMEZONE`
5. Deploy. On your phone, open the URL and "Add to Home Screen" to install it like an app.

## Notes

- Meal photos are compressed in the browser, analyzed once, and discarded — only a small
  thumbnail is stored in the database.
- If AI analysis fails (or `GROQ_API_KEY` is empty), manual entry still works.
