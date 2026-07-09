# AI Meal Logger — Design Spec

**Date:** 2026-07-09
**Status:** Approved by user

## Overview

A password-gated personal web app (installable as a PWA on a phone) for AI-assisted meal logging: snap a photo or type a description of a meal → a Groq vision model returns an editable nutrition estimate → the user reviews/corrects it and saves it to a daily log → a dashboard shows daily totals and weekly trends.

Single user. Deployed on Vercel for on-the-go use. Inspired by Cal AI-style apps but with original UI, branding, and wording.

**Product principle:** fast estimate → easy correction → learns nothing silently. Estimates are always editable and always framed as approximate. No weight-loss pressure language; targets are optional and framed as awareness.

## Scope

### In scope (v1)

- Photo input (camera or upload) and text-description input
- Single Groq vision call returning structured nutrition estimates
- Editable results screen; nothing saved until the user confirms
- Clarification questions (up to 3) that re-run the analysis when answered
- Daily log with per-meal and daily totals
- History view with weekly calorie trend chart
- Meal detail view: edit after saving, delete
- Settings: optional daily calorie/macro targets
- Simple password gate (single shared password, signed cookie)
- Manual entry fallback when AI fails

### Out of scope (v1, possible later)

- Barcode scanning (Open Food Facts)
- Nutrition-label OCR
- Agent chat
- Onboarding wizard
- Multi-user accounts / real auth
- External nutrition databases (USDA, Edamam)
- Supabase or any cloud storage service for images

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Styling | Tailwind CSS |
| ORM / DB | Drizzle ORM over libSQL — `file:local.db` in dev, Turso in production (same code path) |
| AI | Groq API via OpenAI-compatible client; model name from `GROQ_MODEL` env var (default: a Llama 4 vision-capable model, e.g. `meta-llama/llama-4-scout-17b-16e-instruct`) |
| Validation | Zod on every AI response and API input |
| Hosting | Vercel |

### Environment variables

- `GROQ_API_KEY` — Groq API key (user supplies after build)
- `GROQ_MODEL` — model name, defaults to a vision-capable Llama 4 model
- `DATABASE_URL` — `file:local.db` in dev; Turso URL in prod
- `DATABASE_AUTH_TOKEN` — Turso auth token (prod only)
- `APP_PASSWORD` — the single login password
- `SESSION_SECRET` — secret for signing the session cookie

`.env` is git-ignored; a committed `.env.example` documents every variable.

## Screens

1. **Login (`/login`)** — single password field. POST compares against `APP_PASSWORD`, sets a signed HTTP-only cookie. All other pages and API routes redirect/401 without it.
2. **Dashboard (`/`)** — today's calories and macros (vs. optional target when set), list of today's meals grouped by meal type, prominent add-meal button, recent distinct meals for one-tap re-logging.
3. **Add meal (`/add`)** — meal-type selector (breakfast / lunch / dinner / snack); photo capture/upload (compressed client-side) or free-text description; submits to analysis.
4. **Results (within add flow)** — editable card per detected food item: name, portion description, grams, calories, protein/carbs/fat (fibre/sodium when available), confidence, assumptions. Total row. Clarification-question chips when the AI is unsure; answering re-runs analysis with answers as context. Save button persists; Cancel discards.
5. **History (`/history`)** — list of past days with daily totals; weekly calorie trend chart.
6. **Meal detail (`/meals/[id]`)** — full item breakdown, AI assumptions, thumbnail; items editable after saving; meal deletable.
7. **Settings (`/settings`)** — optional daily calorie and macro targets (clearable); shows configured model name.

## Data model (Drizzle schema)

```
meals
  id            text pk (nanoid/uuid)
  meal_type     text        -- breakfast | lunch | dinner | snack
  input_type    text        -- photo | text | manual
  description   text        -- user's text input, if any
  thumbnail     text        -- small base64 JPEG data URL, nullable
  ai_summary    text        -- one-line AI meal summary, nullable
  logged_at     integer     -- unix epoch ms

meal_items
  id            text pk
  meal_id       text fk -> meals.id (cascade delete)
  food_name     text
  quantity_desc text        -- e.g. "1 bowl", "2 slices"
  grams         real        nullable
  calories      real
  protein_g     real
  carbs_g       real
  fat_g         real
  fibre_g       real        nullable
  sodium_mg     real        nullable
  confidence    real        -- 0..1
  assumptions   text        -- JSON array of strings

settings
  id            integer pk  -- always 1 (single row)
  calorie_target  real nullable
  protein_target  real nullable
  carbs_target    real nullable
  fat_target      real nullable
```

No users table — the password gate is the entire auth story.

## AI pipeline

Single endpoint: `POST /api/analyze`

**Input:** `{ image?: base64 jpeg, description?: string, mealType: string, clarifications?: { question, answer }[] }` (at least one of image/description required).

**Behavior:** one Groq chat-completions call (vision content block when image present) in JSON mode. System prompt instructs the model to identify foods, estimate portions and nutrition directly, state assumptions, score confidence per item, and ask at most 3 clarification questions only when genuinely needed. Estimates-only framing baked into the prompt.

**Output (Zod-validated, one retry on malformed JSON):**

```jsonc
{
  "meal_summary": "string",
  "items": [{
    "food_name": "string",
    "quantity_desc": "string",
    "grams": number | null,
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "fibre_g": number | null,
    "sodium_mg": number | null,
    "confidence": number,        // 0..1
    "assumptions": ["string"]
  }],
  "clarification_questions": ["string"]   // 0..3
}
```

Totals are computed server-side from items (not trusted from the model). Nothing is persisted by this endpoint; `POST /api/meals` saves only after user confirmation. If analysis fails after retry, the UI shows an error and offers manual entry.

### Other API routes

- `POST /api/meals` — save confirmed meal + items
- `GET /api/meals?date=` — meals for a day (dashboard/history)
- `GET/PATCH/DELETE /api/meals/[id]` — detail, edit, delete
- `GET/PUT /api/settings` — targets
- `POST /api/login`, `POST /api/logout`

## Image handling

- Browser compresses capture/upload to ≤1024px JPEG (~quality 0.8) via canvas before upload — keeps mobile-data uploads fast.
- The browser also produces a ~300px thumbnail from the same canvas and sends both: the large image is used for analysis and discarded; the thumbnail is stored as a base64 data URL in the `meals` row. No server-side image library, no file storage service; identical behavior in dev and on Vercel.

## Auth

Middleware checks a signed HTTP-only cookie on every page and API route except `/login` and its POST. Login compares the submitted password to `APP_PASSWORD` and sets the cookie (signed with `SESSION_SECRET`, long expiry). Logout clears it. This is a lock on the door, not multi-user auth.

## Safety framing

- Persistent "estimates only — edit anything that looks off" messaging on results.
- No weight-loss pressure language anywhere; targets optional, framed as awareness.
- No medical claims.

## Error handling

- AI returns malformed JSON → one retry with error feedback → manual entry fallback.
- Groq API down / no key → clear message, manual entry still works.
- Image too large / unreadable → client-side compression failure message.
- DB errors surface as toast-style errors; no silent data loss.

## Testing

- Unit tests: Zod schema parsing (valid, malformed, boundary confidence values), server-side totals calculation, portion/number coercion.
- Manual end-to-end verification: real photo → analysis → edit → save → dashboard totals correct; text-only flow; password gate; works from a phone browser on LAN.

## Deployment

- Vercel project connected to the repo; env vars set in Vercel dashboard.
- Turso database created (free tier); `DATABASE_URL` + `DATABASE_AUTH_TOKEN` set in prod.
- Drizzle migrations applied against Turso before first deploy.
- PWA manifest so it can be added to the phone home screen.
