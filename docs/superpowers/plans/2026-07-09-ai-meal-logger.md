# AI Meal Logger ("BiteLog") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A password-gated, single-user Next.js PWA where the user photographs or describes a meal, a Groq vision model returns an editable nutrition estimate, and saved meals feed a daily dashboard and weekly history — deployable to Vercel with Turso.

**Architecture:** One Next.js App Router project serves UI + API. Server components read the DB directly via Drizzle/libSQL; client mutations go through API routes. A single Groq chat-completions call (JSON mode, Zod-validated, one retry) does all AI work. Images never touch disk: the browser compresses to a ≤1024px JPEG for analysis and a ~300px thumbnail stored as a base64 data URL in the meal row.

**Tech Stack:** Next.js 15 (App Router, TS), Tailwind CSS v4, Drizzle ORM + @libsql/client (file:local.db dev / Turso prod), `openai` npm client pointed at Groq, Zod, jose (signed session cookie), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-09-ai-meal-logger-design.md`

**Deliberate deviations from the spec** (simplifications, same behavior):
- `GET /api/meals?date=` and `GET /api/meals/[id]` are dropped — server components query the DB directly. `GET /api/settings` kept.
- New `logged_date` column (YYYY-MM-DD in `APP_TIMEZONE`, default Asia/Singapore) so "today" is stable regardless of Vercel's UTC clock. New env var `APP_TIMEZONE`.
- Cascade delete done explicitly in code (SQLite FK pragma varies across libsql setups).

**File structure (final):**

```
package.json, tsconfig.json, next.config.ts, postcss.config.mjs, vitest.config.ts,
drizzle.config.ts, .gitignore, .env.example, README.md
public/icon.svg
src/middleware.ts
src/lib/db/schema.ts        — Drizzle tables + relations
src/lib/db/index.ts         — libSQL client
src/lib/db/queries.ts       — shared read helpers
src/lib/ai/types.ts         — AnalyzeInput/ChatMessage types
src/lib/ai/schema.ts        — Zod schema for AI JSON
src/lib/ai/prompt.ts        — system prompt + message builder
src/lib/ai/analyze.ts       — Groq call, validation, retry
src/lib/nutrition.ts        — totals math
src/lib/dates.ts            — timezone-aware date strings
src/lib/convert.ts          — DB row ↔ FoodItem mapping
src/lib/image.ts            — client-side canvas compression
src/lib/session.ts          — jose sign/verify
src/app/layout.tsx, globals.css, manifest.ts, apple-icon.tsx, icon.tsx
src/app/login/page.tsx
src/app/(app)/layout.tsx    — bottom nav shell
src/app/(app)/page.tsx      — dashboard
src/app/(app)/add/page.tsx  — add-meal flow
src/app/(app)/history/page.tsx
src/app/(app)/meals/[id]/page.tsx
src/app/(app)/settings/page.tsx
src/app/api/login/route.ts, logout/route.ts, analyze/route.ts,
src/app/api/meals/route.ts, meals/[id]/route.ts, settings/route.ts
src/components/BottomNav.tsx, ItemsEditor.tsx, MacroSummary.tsx, MealCard.tsx,
src/components/RelogButton.tsx, TrendChart.tsx, MealEditor.tsx, DeleteMealButton.tsx,
src/components/SettingsForm.tsx, LogoutButton.tsx
tests/nutrition.test.ts, dates.test.ts, ai-schema.test.ts, ai-analyze.test.ts, session.test.ts
```

All commands below run from the repo root. On Windows use Git Bash syntax (the Bash tool).

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `.gitignore`, `.env.example`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`, `src/components/BottomNav.tsx`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "bitelog",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@libsql/client": "^0.15.0",
    "drizzle-orm": "^0.44.0",
    "jose": "^6.0.0",
    "next": "^15.3.0",
    "openai": "^5.0.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "dotenv": "^16.5.0",
    "drizzle-kit": "^0.31.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.8.0",
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Write `postcss.config.mjs`**

```js
export default {
  plugins: { "@tailwindcss/postcss": {} },
};
```

- [ ] **Step 5: Write `.gitignore`**

```
node_modules/
.next/
.env*
!.env.example
local.db*
*.tsbuildinfo
next-env.d.ts
.vercel/
```

- [ ] **Step 6: Write `.env.example`**

```
# Groq API key from https://console.groq.com — required for AI analysis
GROQ_API_KEY=
# Vision-capable model on Groq
GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
# Local dev: file:local.db — production: Turso libsql:// URL
DATABASE_URL=file:local.db
# Only needed for Turso in production
DATABASE_AUTH_TOKEN=
# The single login password for the app
APP_PASSWORD=
# Random string for signing the session cookie (node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
SESSION_SECRET=
# Day boundaries for the log
APP_TIMEZONE=Asia/Singapore
```

- [ ] **Step 7: Write `src/app/globals.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 8: Write `src/app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BiteLog",
  description: "Personal AI meal logging — estimates only, always editable.",
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-stone-50 text-stone-800 antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Write `src/components/BottomNav.tsx`**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", icon: "🏠", label: "Today" },
  { href: "/add", icon: "📸", label: "Add" },
  { href: "/history", icon: "📊", label: "History" },
  { href: "/settings", icon: "⚙️", label: "Settings" },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-xs ${
              pathname === t.href ? "font-semibold text-emerald-700" : "text-stone-500"
            }`}
          >
            <span aria-hidden className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 10: Write `src/app/(app)/layout.tsx`**

```tsx
import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-md pb-24">
      {children}
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 11: Write placeholder `src/app/(app)/page.tsx`** (replaced in Task 11)

```tsx
export default function Dashboard() {
  return <main className="p-4">BiteLog</main>;
}
```

- [ ] **Step 12: Install dependencies**

Run: `npm install`
Expected: completes without errors (warnings OK).

- [ ] **Step 13: Verify the build**

Run: `npm run build`
Expected: "Compiled successfully", route `/` listed.

- [ ] **Step 14: Commit**

```bash
git add -A && git commit -m "feat: scaffold Next.js + Tailwind project shell"
```

---

### Task 2: Database layer

**Files:**
- Create: `src/lib/db/schema.ts`, `src/lib/db/index.ts`, `drizzle.config.ts`, `.env` (from example)

- [ ] **Step 1: Write `src/lib/db/schema.ts`**

```ts
import { relations } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const meals = sqliteTable("meals", {
  id: text("id").primaryKey(),
  mealType: text("meal_type").notNull(), // breakfast | lunch | dinner | snack
  inputType: text("input_type").notNull(), // photo | text | manual
  description: text("description"),
  thumbnail: text("thumbnail"), // small base64 JPEG data URL
  aiSummary: text("ai_summary"),
  loggedAt: integer("logged_at").notNull(), // epoch ms
  loggedDate: text("logged_date").notNull(), // YYYY-MM-DD in APP_TIMEZONE
});

export const mealItems = sqliteTable("meal_items", {
  id: text("id").primaryKey(),
  mealId: text("meal_id")
    .notNull()
    .references(() => meals.id, { onDelete: "cascade" }),
  foodName: text("food_name").notNull(),
  quantityDesc: text("quantity_desc").notNull(),
  grams: real("grams"),
  calories: real("calories").notNull(),
  proteinG: real("protein_g").notNull(),
  carbsG: real("carbs_g").notNull(),
  fatG: real("fat_g").notNull(),
  fibreG: real("fibre_g"),
  sodiumMg: real("sodium_mg"),
  confidence: real("confidence").notNull(), // 0..1
  assumptions: text("assumptions").notNull().default("[]"), // JSON string[]
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(), // always 1
  calorieTarget: real("calorie_target"),
  proteinTarget: real("protein_target"),
  carbsTarget: real("carbs_target"),
  fatTarget: real("fat_target"),
});

export const mealsRelations = relations(meals, ({ many }) => ({
  items: many(mealItems),
}));

export const mealItemsRelations = relations(mealItems, ({ one }) => ({
  meal: one(meals, { fields: [mealItems.mealId], references: [meals.id] }),
}));
```

- [ ] **Step 2: Write `src/lib/db/index.ts`**

```ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const client = createClient({
  url: process.env.DATABASE_URL ?? "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

export const db = drizzle(client, { schema });
```

- [ ] **Step 3: Write `drizzle.config.ts`**

```ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  },
});
```

- [ ] **Step 4: Create `.env` for local dev**

```bash
cp .env.example .env
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

Edit `.env`: paste the generated `SESSION_SECRET`, set `APP_PASSWORD=bitelog-dev` (user changes later). Leave `GROQ_API_KEY` empty for now.

- [ ] **Step 5: Push the schema**

Run: `npm run db:push`
Expected: "Changes applied" (creates `local.db` with 3 tables).

- [ ] **Step 6: Verify tables exist**

Run:
```bash
node -e "const{createClient}=require('@libsql/client');createClient({url:'file:local.db'}).execute(\"select name from sqlite_master where type='table' order by name\").then(r=>console.log(r.rows.map(x=>x.name).join(',')))"
```
Expected output includes: `meal_items,meals,settings`

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: drizzle schema and libsql client"
```

---

### Task 3: Nutrition totals (TDD)

**Files:**
- Create: `vitest.config.ts`, `tests/nutrition.test.ts`, `src/lib/nutrition.ts`

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 2: Write failing test `tests/nutrition.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { calcTotals, type ItemNutrition } from "@/lib/nutrition";

const item = (over: Partial<ItemNutrition>): ItemNutrition => ({
  calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: null, sodium_mg: null, ...over,
});

describe("calcTotals", () => {
  it("returns zeros and null optionals for an empty list", () => {
    expect(calcTotals([])).toEqual({
      calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: null, sodium_mg: null,
    });
  });

  it("sums calories and macros across items", () => {
    const totals = calcTotals([
      item({ calories: 300, protein_g: 20, carbs_g: 30, fat_g: 10 }),
      item({ calories: 150, protein_g: 5, carbs_g: 25, fat_g: 3 }),
    ]);
    expect(totals.calories).toBe(450);
    expect(totals.protein_g).toBe(25);
    expect(totals.carbs_g).toBe(55);
    expect(totals.fat_g).toBe(13);
  });

  it("rounds sums to 1 decimal place", () => {
    const totals = calcTotals([item({ fat_g: 1.15 }), item({ fat_g: 1.15 })]);
    expect(totals.fat_g).toBe(2.3);
  });

  it("keeps fibre/sodium null when every item is null", () => {
    const totals = calcTotals([item({}), item({})]);
    expect(totals.fibre_g).toBeNull();
    expect(totals.sodium_mg).toBeNull();
  });

  it("sums known fibre/sodium values, treating null as 0", () => {
    const totals = calcTotals([item({ fibre_g: 2.5, sodium_mg: 300 }), item({ fibre_g: null })]);
    expect(totals.fibre_g).toBe(2.5);
    expect(totals.sodium_mg).toBe(300);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/nutrition`.

- [ ] **Step 4: Write `src/lib/nutrition.ts`**

```ts
export interface ItemNutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number | null;
  sodium_mg: number | null;
}

export interface NutritionTotals extends ItemNutrition {}

const round1 = (v: number) => Math.round(v * 10) / 10;

function sumOptional(values: (number | null)[]): number | null {
  if (values.length === 0 || values.every((v) => v === null)) return null;
  return round1(values.reduce<number>((acc, v) => acc + (v ?? 0), 0));
}

export function calcTotals(items: ItemNutrition[]): NutritionTotals {
  return {
    calories: round1(items.reduce((a, i) => a + i.calories, 0)),
    protein_g: round1(items.reduce((a, i) => a + i.protein_g, 0)),
    carbs_g: round1(items.reduce((a, i) => a + i.carbs_g, 0)),
    fat_g: round1(items.reduce((a, i) => a + i.fat_g, 0)),
    fibre_g: sumOptional(items.map((i) => i.fibre_g)),
    sodium_mg: sumOptional(items.map((i) => i.sodium_mg)),
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all nutrition tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: nutrition totals calculation with tests"
```

---

### Task 4: Date helpers (TDD)

**Files:**
- Create: `tests/dates.test.ts`, `src/lib/dates.ts`

- [ ] **Step 1: Write failing test `tests/dates.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { dateStringFor, formatDisplayDate, lastNDates, weekdayLetter } from "@/lib/dates";

describe("dateStringFor", () => {
  it("converts an epoch to YYYY-MM-DD in the given timezone", () => {
    // 2026-07-08 17:00 UTC = 2026-07-09 01:00 in Singapore
    const epoch = Date.UTC(2026, 6, 8, 17, 0, 0);
    expect(dateStringFor(epoch, "Asia/Singapore")).toBe("2026-07-09");
    expect(dateStringFor(epoch, "UTC")).toBe("2026-07-08");
  });
});

describe("lastNDates", () => {
  it("returns n ascending dates ending today", () => {
    const dates = lastNDates(7, "Asia/Singapore");
    expect(dates).toHaveLength(7);
    expect(dates[6]).toBe(dateStringFor(Date.now(), "Asia/Singapore"));
    expect(dates[0] < dates[6]).toBe(true);
  });
});

describe("weekdayLetter", () => {
  it("returns the narrow weekday for a date string", () => {
    expect(weekdayLetter("2026-07-09")).toBe("T"); // Thursday
    expect(weekdayLetter("2026-07-12")).toBe("S"); // Sunday
  });
});

describe("formatDisplayDate", () => {
  it("formats a date string for display", () => {
    expect(formatDisplayDate("2026-07-09")).toContain("9");
    expect(formatDisplayDate("2026-07-09")).toContain("Jul");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/dates`.

- [ ] **Step 3: Write `src/lib/dates.ts`**

```ts
const DEFAULT_TZ = process.env.APP_TIMEZONE || "Asia/Singapore";

export function dateStringFor(epochMs: number, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(epochMs));
}

export function todayString(tz: string = DEFAULT_TZ): string {
  return dateStringFor(Date.now(), tz);
}

/** n date strings ascending, ending today. DST edge days are acceptable for this app. */
export function lastNDates(n: number, tz: string = DEFAULT_TZ): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(dateStringFor(Date.now() - i * 86_400_000, tz));
  return out;
}

export function weekdayLetter(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "narrow", timeZone: "UTC" }).format(
    new Date(`${dateStr}T00:00:00Z`),
  );
}

export function formatDisplayDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateStr}T00:00:00Z`));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all date tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: timezone-aware date helpers with tests"
```

---

### Task 5: AI response schema (TDD)

**Files:**
- Create: `tests/ai-schema.test.ts`, `src/lib/ai/schema.ts`

- [ ] **Step 1: Write failing test `tests/ai-schema.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { analysisSchema } from "@/lib/ai/schema";

const validItem = {
  food_name: "Chicken rice",
  quantity_desc: "1 plate",
  grams: 400,
  calories: 600,
  protein_g: 30,
  carbs_g: 70,
  fat_g: 20,
  fibre_g: 2,
  sodium_mg: 1200,
  confidence: 0.8,
  assumptions: ["assumed roasted chicken"],
};

describe("analysisSchema", () => {
  it("parses a full valid response", () => {
    const parsed = analysisSchema.parse({
      meal_summary: "Chicken rice",
      items: [validItem],
      clarification_questions: ["Roasted or steamed chicken?"],
    });
    expect(parsed.items[0].calories).toBe(600);
    expect(parsed.clarification_questions).toHaveLength(1);
  });

  it("defaults missing optional numbers to null", () => {
    const { fibre_g, sodium_mg, grams, ...required } = validItem;
    const parsed = analysisSchema.parse({ meal_summary: "x", items: [required] });
    expect(parsed.items[0].fibre_g).toBeNull();
    expect(parsed.items[0].sodium_mg).toBeNull();
    expect(parsed.items[0].grams).toBeNull();
  });

  it("defaults missing clarification_questions to empty array", () => {
    const parsed = analysisSchema.parse({ meal_summary: "x", items: [validItem] });
    expect(parsed.clarification_questions).toEqual([]);
  });

  it("caps clarification questions at 3", () => {
    const parsed = analysisSchema.parse({
      meal_summary: "x",
      items: [validItem],
      clarification_questions: ["a", "b", "c", "d", "e"],
    });
    expect(parsed.clarification_questions).toHaveLength(3);
  });

  it("rejects an empty items array", () => {
    expect(analysisSchema.safeParse({ meal_summary: "x", items: [] }).success).toBe(false);
  });

  it("rejects out-of-range confidence", () => {
    const bad = { ...validItem, confidence: 1.5 };
    expect(analysisSchema.safeParse({ meal_summary: "x", items: [bad] }).success).toBe(false);
  });

  it("rejects non-numeric calories", () => {
    const bad = { ...validItem, calories: "lots" };
    expect(analysisSchema.safeParse({ meal_summary: "x", items: [bad] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/ai/schema`.

- [ ] **Step 3: Write `src/lib/ai/schema.ts`**

```ts
import { z } from "zod";

const optionalNumber = z.number().min(0).nullish().default(null);

export const foodItemSchema = z.object({
  food_name: z.string().min(1),
  quantity_desc: z.string().default(""),
  grams: z.number().positive().nullish().default(null),
  calories: z.number().min(0),
  protein_g: z.number().min(0),
  carbs_g: z.number().min(0),
  fat_g: z.number().min(0),
  fibre_g: optionalNumber,
  sodium_mg: optionalNumber,
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string()).default([]),
});

export const analysisSchema = z.object({
  meal_summary: z.string().default(""),
  items: z.array(foodItemSchema).min(1),
  clarification_questions: z
    .array(z.string())
    .default([])
    .transform((qs) => qs.slice(0, 3)),
});

export type FoodItem = z.infer<typeof foodItemSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all ai-schema tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: zod schema for AI analysis responses"
```

---

### Task 6: AI prompt + analyze service with retry (TDD)

**Files:**
- Create: `src/lib/ai/types.ts`, `src/lib/ai/prompt.ts`, `tests/ai-analyze.test.ts`, `src/lib/ai/analyze.ts`

- [ ] **Step 1: Write `src/lib/ai/types.ts`**

```ts
export interface Clarification {
  question: string;
  answer: string;
}

export interface AnalyzeInput {
  imageDataUrl?: string;
  description?: string;
  mealType: string;
  clarifications?: Clarification[];
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};
```

- [ ] **Step 2: Write `src/lib/ai/prompt.ts`**

```ts
import type { AnalyzeInput, ChatMessage, ContentPart } from "./types";

export const SYSTEM_PROMPT = `You are the nutrition analysis engine of a personal meal-logging app.
Identify every distinct food and drink in the user's meal (from a photo, a text description, or both) and estimate its nutrition directly.

Respond with ONLY a JSON object, no markdown fences, in exactly this shape:
{
  "meal_summary": string,
  "items": [{
    "food_name": string,
    "quantity_desc": string,
    "grams": number | null,
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "fibre_g": number | null,
    "sodium_mg": number | null,
    "confidence": number,
    "assumptions": [string]
  }],
  "clarification_questions": [string]
}

Rules:
- "meal_summary" is one short line, e.g. "Chicken rice with iced tea".
- Numbers are for the stated portion, NOT per 100 g.
- "confidence" is 0 to 1 per item; lower it when portions are unclear or food is partly hidden.
- Account for hidden ingredients (cooking oil, sugar in drinks, sauces) and state them in "assumptions".
- Be realistic about Asian and Singaporean hawker dishes as well as Western food.
- "clarification_questions": at most 3, ONLY when the answer would materially change the estimate (e.g. "Fried or steamed?", "Was the drink sweetened?"). Usually return [].
- These are rough estimates for personal awareness, never medical advice. Never comment on the user's body or choices.`;

export function buildMessages(input: AnalyzeInput): ChatMessage[] {
  const lines: string[] = [`Meal type: ${input.mealType}.`];
  if (input.description) lines.push(`The user describes the meal as: "${input.description}"`);
  if (input.imageDataUrl) lines.push("A photo of the meal is attached.");
  else lines.push("No photo is available; estimate from the description alone.");
  if (input.clarifications?.length) {
    lines.push("The user answered your earlier clarification questions:");
    for (const c of input.clarifications) lines.push(`- Q: ${c.question} A: ${c.answer}`);
    lines.push("Incorporate these answers and do not ask them again.");
  }
  const text = lines.join("\n");
  const content: string | ContentPart[] = input.imageDataUrl
    ? [
        { type: "text", text },
        { type: "image_url", image_url: { url: input.imageDataUrl } },
      ]
    : text;
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content },
  ];
}
```

- [ ] **Step 3: Write failing test `tests/ai-analyze.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { AnalysisError, analyzeWith } from "@/lib/ai/analyze";
import type { ChatMessage } from "@/lib/ai/types";

const validJson = JSON.stringify({
  meal_summary: "Toast",
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
  clarification_questions: [],
});

const input = { description: "two slices of toast", mealType: "breakfast" };

describe("analyzeWith", () => {
  it("returns the parsed analysis on a first valid reply", async () => {
    const complete = vi.fn().mockResolvedValue(validJson);
    const result = await analyzeWith(complete, input);
    expect(result.items[0].food_name).toBe("Toast");
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("strips markdown fences before parsing", async () => {
    const complete = vi.fn().mockResolvedValue("```json\n" + validJson + "\n```");
    const result = await analyzeWith(complete, input);
    expect(result.items).toHaveLength(1);
  });

  it("retries once with feedback after an invalid reply", async () => {
    const complete = vi
      .fn()
      .mockResolvedValueOnce("this is not json")
      .mockResolvedValueOnce(validJson);
    const result = await analyzeWith(complete, input);
    expect(result.meal_summary).toBe("Toast");
    expect(complete).toHaveBeenCalledTimes(2);
    const retryMessages = complete.mock.calls[1][0] as ChatMessage[];
    const last = retryMessages[retryMessages.length - 1];
    expect(String(last.content)).toContain("ONLY the JSON object");
  });

  it("throws AnalysisError after two invalid replies", async () => {
    const complete = vi.fn().mockResolvedValue("still not json");
    await expect(analyzeWith(complete, input)).rejects.toBeInstanceOf(AnalysisError);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("retries when the schema rejects valid JSON", async () => {
    const badShape = JSON.stringify({ meal_summary: "x", items: [] });
    const complete = vi
      .fn()
      .mockResolvedValueOnce(badShape)
      .mockResolvedValueOnce(validJson);
    const result = await analyzeWith(complete, input);
    expect(result.items).toHaveLength(1);
    expect(complete).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/ai/analyze`.

- [ ] **Step 5: Write `src/lib/ai/analyze.ts`**

```ts
import OpenAI from "openai";
import { analysisSchema, type Analysis } from "./schema";
import { buildMessages } from "./prompt";
import type { AnalyzeInput, ChatMessage } from "./types";

export class AnalysisError extends Error {}

export type Completer = (messages: ChatMessage[]) => Promise<string>;

function extractJson(raw: string): unknown {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  return JSON.parse(trimmed);
}

export async function analyzeWith(complete: Completer, input: AnalyzeInput): Promise<Analysis> {
  const messages = buildMessages(input);
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const attemptMessages: ChatMessage[] =
      attempt === 0
        ? messages
        : [
            ...messages,
            {
              role: "user",
              content: `Your previous reply was not valid (${lastError}). Reply again with ONLY the JSON object in the required shape.`,
            },
          ];
    let raw: string;
    try {
      raw = await complete(attemptMessages);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      continue;
    }
    let json: unknown;
    try {
      json = extractJson(raw);
    } catch {
      lastError = "response was not valid JSON";
      continue;
    }
    const parsed = analysisSchema.safeParse(json);
    if (parsed.success) return parsed.data;
    lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }
  throw new AnalysisError(`AI analysis failed: ${lastError}`);
}

export function groqCompleter(): Completer {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new AnalysisError("GROQ_API_KEY is not set");
  const client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
  const model = process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
  return async (messages) => {
    const res = await client.chat.completions.create({
      model,
      messages: messages as unknown as OpenAI.Chat.ChatCompletionMessageParam[],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_completion_tokens: 2000,
    });
    return res.choices[0]?.message?.content ?? "";
  };
}

export async function analyzeMeal(input: AnalyzeInput): Promise<Analysis> {
  return analyzeWith(groqCompleter(), input);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: all ai-analyze tests PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: groq analysis service with validation retry"
```

---

### Task 7: Session, middleware, login

**Files:**
- Create: `tests/session.test.ts`, `src/lib/session.ts`, `src/middleware.ts`, `src/app/api/login/route.ts`, `src/app/api/logout/route.ts`, `src/app/login/page.tsx`

- [ ] **Step 1: Write failing test `tests/session.test.ts`**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/session";

describe("session tokens", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret-at-least-32-chars-long!!";
  });

  it("round-trips a valid token", async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token.slice(0, -2) + "xx")).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken();
    process.env.SESSION_SECRET = "another-secret-entirely-32-chars!!!";
    expect(await verifySessionToken(token)).toBe(false);
  });

  it("rejects garbage", async () => {
    expect(await verifySessionToken("not-a-jwt")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/session`.

- [ ] **Step 3: Write `src/lib/session.ts`** (jose only — must run in Edge middleware)

```ts
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "bitelog_session";

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ app: "bitelog" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secretKey());
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: session tests PASS.

- [ ] **Step 5: Write `src/middleware.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/api/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token && (await verifySessionToken(token))) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  // exclude static assets and generated icons/manifest from auth
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icon|apple-icon|manifest\\.webmanifest).*)"],
};
```

- [ ] **Step 6: Write `src/app/api/login/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, createSessionToken } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  const expected = process.env.APP_PASSWORD;
  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });
  return res;
}
```

- [ ] **Step 7: Write `src/app/api/logout/route.ts`**

```ts
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
  return res;
}
```

- [ ] **Step 8: Write `src/app/login/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Wrong password — try again.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-center text-3xl font-bold">🥗 BiteLog</h1>
        <p className="text-center text-sm text-stone-500">Your personal meal log</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={busy || !password}
          className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 9: Verify the gate manually**

Start dev server in background: `npm run dev`
Then:
```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/
# Expected: 307 http://localhost:3000/login
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d '{"password":"wrong"}'
# Expected: 401
curl -s -c /tmp/jar.txt -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d '{"password":"bitelog-dev"}'
# Expected: 200
curl -s -b /tmp/jar.txt -o /dev/null -w "%{http_code}\n" http://localhost:3000/
# Expected: 200
```

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: password gate with signed session cookie"
```

---

### Task 8: Query helpers + API routes

**Files:**
- Create: `src/lib/db/queries.ts`, `src/lib/convert.ts`, `src/app/api/analyze/route.ts`, `src/app/api/meals/route.ts`, `src/app/api/meals/[id]/route.ts`, `src/app/api/settings/route.ts`

- [ ] **Step 1: Write `src/lib/db/queries.ts`**

```ts
import { desc, eq } from "drizzle-orm";
import { db } from "./index";
import { mealItems, meals, settings } from "./schema";

export type MealRow = typeof meals.$inferSelect;
export type MealItemRow = typeof mealItems.$inferSelect;
export type MealWithItems = MealRow & { items: MealItemRow[] };
export type SettingsRow = typeof settings.$inferSelect;

export async function getMealsByDate(date: string): Promise<MealWithItems[]> {
  return db.query.meals.findMany({
    where: eq(meals.loggedDate, date),
    with: { items: true },
    orderBy: [desc(meals.loggedAt)],
  });
}

export async function getMealWithItems(id: string): Promise<MealWithItems | undefined> {
  return db.query.meals.findFirst({ where: eq(meals.id, id), with: { items: true } });
}

export async function getRecentMeals(limit = 8): Promise<MealWithItems[]> {
  return db.query.meals.findMany({
    with: { items: true },
    orderBy: [desc(meals.loggedAt)],
    limit,
  });
}

export async function getAllMealsWithItems(limit = 500): Promise<MealWithItems[]> {
  return db.query.meals.findMany({
    with: { items: true },
    orderBy: [desc(meals.loggedAt)],
    limit,
  });
}

const DEFAULT_SETTINGS: SettingsRow = {
  id: 1,
  calorieTarget: null,
  proteinTarget: null,
  carbsTarget: null,
  fatTarget: null,
};

export async function getSettings(): Promise<SettingsRow> {
  const row = await db.query.settings.findFirst();
  if (row) return row;
  await db.insert(settings).values(DEFAULT_SETTINGS).onConflictDoNothing();
  return { ...DEFAULT_SETTINGS };
}
```

- [ ] **Step 2: Write `src/lib/convert.ts`**

```ts
import type { FoodItem } from "./ai/schema";
import type { MealItemRow } from "./db/queries";

export function dbItemToFoodItem(row: MealItemRow): FoodItem {
  let assumptions: string[] = [];
  try {
    const parsed = JSON.parse(row.assumptions ?? "[]");
    if (Array.isArray(parsed)) assumptions = parsed.filter((a) => typeof a === "string");
  } catch {
    // ignore malformed stored JSON
  }
  return {
    food_name: row.foodName,
    quantity_desc: row.quantityDesc,
    grams: row.grams,
    calories: row.calories,
    protein_g: row.proteinG,
    carbs_g: row.carbsG,
    fat_g: row.fatG,
    fibre_g: row.fibreG,
    sodium_mg: row.sodiumMg,
    confidence: row.confidence,
    assumptions,
  };
}

export function foodItemToDbValues(item: FoodItem, mealId: string) {
  return {
    id: crypto.randomUUID(),
    mealId,
    foodName: item.food_name,
    quantityDesc: item.quantity_desc,
    grams: item.grams,
    calories: item.calories,
    proteinG: item.protein_g,
    carbsG: item.carbs_g,
    fatG: item.fat_g,
    fibreG: item.fibre_g,
    sodiumMg: item.sodium_mg,
    confidence: item.confidence,
    assumptions: JSON.stringify(item.assumptions),
  };
}
```

- [ ] **Step 3: Write `src/app/api/analyze/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeMeal } from "@/lib/ai/analyze";
import { calcTotals } from "@/lib/nutrition";

export const maxDuration = 30;

const bodySchema = z
  .object({
    image: z.string().startsWith("data:image/").max(2_000_000).optional(),
    description: z.string().trim().max(2000).optional(),
    mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
    clarifications: z
      .array(z.object({ question: z.string().max(500), answer: z.string().max(500) }))
      .max(6)
      .optional(),
  })
  .refine((b) => b.image || (b.description && b.description.length > 0), {
    message: "Provide a photo or a description",
  });

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a photo or a description." }, { status: 400 });
  }
  const { image, description, mealType, clarifications } = parsed.data;
  try {
    const analysis = await analyzeMeal({ imageDataUrl: image, description, mealType, clarifications });
    return NextResponse.json({ ...analysis, totals: calcTotals(analysis.items) });
  } catch (err) {
    console.error("analyze failed:", err);
    return NextResponse.json(
      { error: "The AI couldn't analyze this meal. Try again, or enter it manually." },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 4: Write `src/app/api/meals/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { foodItemSchema } from "@/lib/ai/schema";
import { foodItemToDbValues } from "@/lib/convert";
import { dateStringFor } from "@/lib/dates";
import { db } from "@/lib/db";
import { mealItems, meals } from "@/lib/db/schema";

const saveSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  inputType: z.enum(["photo", "text", "manual"]),
  description: z.string().max(2000).nullish(),
  thumbnail: z.string().startsWith("data:image/").max(200_000).nullish(),
  aiSummary: z.string().max(300).nullish(),
  items: z.array(foodItemSchema).min(1),
});

export async function POST(req: NextRequest) {
  const parsed = saveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid meal data" }, { status: 400 });
  }
  const d = parsed.data;
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.insert(meals).values({
    id,
    mealType: d.mealType,
    inputType: d.inputType,
    description: d.description ?? null,
    thumbnail: d.thumbnail ?? null,
    aiSummary: d.aiSummary ?? null,
    loggedAt: now,
    loggedDate: dateStringFor(now),
  });
  await db.insert(mealItems).values(d.items.map((i) => foodItemToDbValues(i, id)));
  return NextResponse.json({ id });
}
```

- [ ] **Step 5: Write `src/app/api/meals/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { foodItemSchema } from "@/lib/ai/schema";
import { foodItemToDbValues } from "@/lib/convert";
import { db } from "@/lib/db";
import { mealItems, meals } from "@/lib/db/schema";

const patchSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  description: z.string().max(2000).nullish(),
  items: z.array(foodItemSchema).min(1).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await db.query.meals.findFirst({ where: eq(meals.id, id) });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  const d = parsed.data;
  if (d.mealType || d.description !== undefined) {
    await db
      .update(meals)
      .set({
        ...(d.mealType ? { mealType: d.mealType } : {}),
        ...(d.description !== undefined ? { description: d.description ?? null } : {}),
      })
      .where(eq(meals.id, id));
  }
  if (d.items) {
    await db.delete(mealItems).where(eq(mealItems.mealId, id));
    await db.insert(mealItems).values(d.items.map((i) => foodItemToDbValues(i, id)));
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await db.delete(mealItems).where(eq(mealItems.mealId, id));
  await db.delete(meals).where(eq(meals.id, id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Write `src/app/api/settings/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/db/queries";
import { settings } from "@/lib/db/schema";

const putSchema = z.object({
  calorieTarget: z.number().positive().max(20000).nullable(),
  proteinTarget: z.number().positive().max(2000).nullable(),
  carbsTarget: z.number().positive().max(2000).nullable(),
  fatTarget: z.number().positive().max(2000).nullable(),
});

export async function GET() {
  return NextResponse.json(await getSettings());
}

export async function PUT(req: NextRequest) {
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  await getSettings(); // ensure the row exists
  await db.update(settings).set(parsed.data).where(eq(settings.id, 1));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Verify with curl (dev server running, using cookie jar from Task 7)**

```bash
curl -s -b /tmp/jar.txt -X POST http://localhost:3000/api/meals -H "Content-Type: application/json" -d '{"mealType":"lunch","inputType":"manual","items":[{"food_name":"Test rice","quantity_desc":"1 bowl","grams":200,"calories":260,"protein_g":5,"carbs_g":56,"fat_g":1,"fibre_g":null,"sodium_mg":null,"confidence":1,"assumptions":[]}]}'
# Expected: {"id":"<uuid>"}
curl -s -b /tmp/jar.txt http://localhost:3000/api/settings
# Expected: {"id":1,"calorieTarget":null,...}
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/meals -H "Content-Type: application/json" -d '{}'
# Expected: 401 (no cookie)
```
Then delete the test meal:
```bash
curl -s -b /tmp/jar.txt -X DELETE http://localhost:3000/api/meals/<uuid-from-above>
# Expected: {"ok":true}
```

- [ ] **Step 8: Run the full test suite and build**

Run: `npm test && npm run build`
Expected: tests PASS, build succeeds.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: query helpers and meal/analyze/settings API routes"
```

---

### Task 9: Image compression + items editor component

**Files:**
- Create: `src/lib/image.ts`, `src/components/ItemsEditor.tsx`

- [ ] **Step 1: Write `src/lib/image.ts`** (client-side only — uses canvas)

```ts
async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawScaled(img: HTMLImageElement, maxDim: number, quality: number): string {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Compress a photo: `large` (≤1024px, for AI analysis) + `thumb` (≤300px, stored in DB). */
export async function prepareImage(file: Blob): Promise<{ large: string; thumb: string }> {
  const img = await blobToImage(file);
  return { large: drawScaled(img, 1024, 0.8), thumb: drawScaled(img, 300, 0.7) };
}
```

- [ ] **Step 2: Write `src/components/ItemsEditor.tsx`**

```tsx
"use client";
import type { FoodItem } from "@/lib/ai/schema";

export function emptyItem(): FoodItem {
  return {
    food_name: "",
    quantity_desc: "1 serving",
    grams: null,
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fibre_g: null,
    sodium_mg: null,
    confidence: 1,
    assumptions: [],
  };
}

function NumberField({
  label,
  value,
  onChange,
  allowNull = false,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  allowNull?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-stone-500">
      {label}
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value ?? ""}
        onChange={(e) => {
          if (e.target.value === "") return onChange(allowNull ? null : 0);
          onChange(Math.max(0, Number(e.target.value)));
        }}
        className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-800"
      />
    </label>
  );
}

export default function ItemsEditor({
  items,
  onChange,
}: {
  items: FoodItem[];
  onChange: (items: FoodItem[]) => void;
}) {
  function update(index: number, patch: Partial<FoodItem>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-2">
            <input
              value={item.food_name}
              onChange={(e) => update(i, { food_name: e.target.value })}
              placeholder="Food name"
              className="flex-1 rounded-lg border border-stone-300 px-2 py-1.5 font-medium"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label="Remove item"
              className="px-2 py-1.5 text-stone-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="col-span-2 flex flex-col gap-1 text-xs text-stone-500">
              Portion
              <input
                value={item.quantity_desc}
                onChange={(e) => update(i, { quantity_desc: e.target.value })}
                placeholder="e.g. 1 bowl"
                className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-800"
              />
            </label>
            <NumberField label="Grams" value={item.grams} allowNull onChange={(v) => update(i, { grams: v })} />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <NumberField label="kcal" value={item.calories} onChange={(v) => update(i, { calories: v ?? 0 })} />
            <NumberField label="Protein" value={item.protein_g} onChange={(v) => update(i, { protein_g: v ?? 0 })} />
            <NumberField label="Carbs" value={item.carbs_g} onChange={(v) => update(i, { carbs_g: v ?? 0 })} />
            <NumberField label="Fat" value={item.fat_g} onChange={(v) => update(i, { fat_g: v ?? 0 })} />
          </div>
          {item.confidence < 0.95 && (
            <p className="text-xs text-stone-400">AI confidence: {Math.round(item.confidence * 100)}%</p>
          )}
          {item.assumptions.length > 0 && (
            <ul className="list-disc pl-4 text-xs text-stone-400">
              {item.assumptions.map((a, j) => (
                <li key={j}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, emptyItem()])}
        className="w-full rounded-xl border border-dashed border-stone-300 py-2.5 text-sm text-stone-500"
      >
        + Add item
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: client image compression and editable food items"
```

---

### Task 10: Add-meal flow

**Files:**
- Create: `src/app/(app)/add/page.tsx`

- [ ] **Step 1: Write `src/app/(app)/add/page.tsx`**

```tsx
"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ItemsEditor, { emptyItem } from "@/components/ItemsEditor";
import type { FoodItem } from "@/lib/ai/schema";
import type { Clarification } from "@/lib/ai/types";
import { prepareImage } from "@/lib/image";
import { calcTotals } from "@/lib/nutrition";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type Phase = "input" | "analyzing" | "review";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 18) return "snack";
  return "dinner";
}

export default function AddMealPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("input");
  const [mealType, setMealType] = useState<MealType>(defaultMealType());
  const [description, setDescription] = useState("");
  const [large, setLarge] = useState<string | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [summary, setSummary] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [isManual, setIsManual] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const { large, thumb } = await prepareImage(file);
      setLarge(large);
      setThumb(thumb);
    } catch {
      setError("Couldn't read that image — try a different photo.");
    }
  }

  async function analyze(extra: Clarification[] = []) {
    const clars = [...clarifications, ...extra];
    setPhase("analyzing");
    setError("");
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: large ?? undefined,
        description: description.trim() || undefined,
        mealType,
        clarifications: clars.length ? clars : undefined,
      }),
    }).catch(() => null);
    if (!res || !res.ok) {
      const data = res ? await res.json().catch(() => null) : null;
      setError(data?.error ?? "Analysis failed — check your connection and try again.");
      setPhase(items.length ? "review" : "input");
      return;
    }
    const data = await res.json();
    setItems(data.items);
    setSummary(data.meal_summary);
    setQuestions(data.clarification_questions ?? []);
    setAnswers({});
    setClarifications(clars);
    setIsManual(false);
    setPhase("review");
  }

  function refine() {
    const extra = questions
      .map((q, i) => ({ question: q, answer: (answers[i] ?? "").trim() }))
      .filter((c) => c.answer);
    if (extra.length) void analyze(extra);
  }

  function startManual() {
    setItems([emptyItem()]);
    setSummary("");
    setQuestions([]);
    setIsManual(true);
    setError("");
    setPhase("review");
  }

  async function save() {
    if (items.some((i) => !i.food_name.trim())) {
      setError("Every item needs a name.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mealType,
        inputType: large ? "photo" : isManual ? "manual" : "text",
        description: description.trim() || null,
        thumbnail: thumb,
        aiSummary: summary || null,
        items,
      }),
    }).catch(() => null);
    setSaving(false);
    if (res?.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Couldn't save the meal — try again.");
    }
  }

  const totals = calcTotals(items);

  return (
    <main className="space-y-4 p-4">
      <h1 className="text-xl font-bold">Add meal</h1>

      <div className="grid grid-cols-4 gap-1 rounded-xl bg-stone-200 p-1">
        {MEAL_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setMealType(t)}
            className={`rounded-lg py-1.5 text-sm capitalize ${
              mealType === t ? "bg-white font-semibold shadow-sm" : "text-stone-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {phase === "input" && (
        <>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
            onChange={(e) => onFile(e.target.files?.[0])} />
          <input ref={galleryRef} type="file" accept="image/*" hidden
            onChange={(e) => onFile(e.target.files?.[0])} />

          {thumb ? (
            <div className="relative overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb} alt="Meal preview" className="w-full" />
              <button
                type="button"
                onClick={() => { setLarge(null); setThumb(null); }}
                className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-sm text-white"
              >
                ✕ Remove
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-2xl border border-stone-200 bg-white py-8 shadow-sm">
                <span className="text-3xl">📸</span>
                <span className="text-sm font-medium">Take photo</span>
              </button>
              <button type="button" onClick={() => galleryRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-2xl border border-stone-200 bg-white py-8 shadow-sm">
                <span className="text-3xl">🖼️</span>
                <span className="text-sm font-medium">Upload</span>
              </button>
            </div>
          )}

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="…or describe the meal (e.g. 'chicken rice with iced milo')"
            rows={3}
            className="w-full rounded-2xl border border-stone-200 bg-white p-3 text-sm shadow-sm"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={() => void analyze()}
            disabled={!large && !description.trim()}
            className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-40"
          >
            Analyze with AI
          </button>
          <button type="button" onClick={startManual} className="w-full py-2 text-sm text-stone-500 underline">
            Enter manually instead
          </button>
          <p className="text-center text-xs text-stone-400">
            Photos are analyzed by AI and not stored — only a small thumbnail is kept.
          </p>
        </>
      )}

      {phase === "analyzing" && (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-sm text-stone-500">Analyzing your meal…</p>
        </div>
      )}

      {phase === "review" && (
        <>
          {summary && <p className="font-medium">{summary}</p>}
          <p className="text-xs text-stone-400">Estimates only — tap any number to correct it.</p>

          {questions.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">Quick questions to improve the estimate (optional):</p>
              {questions.map((q, i) => (
                <label key={i} className="block text-sm text-amber-900">
                  {q}
                  <input
                    value={answers[i] ?? ""}
                    onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm"
                  />
                </label>
              ))}
              <button type="button" onClick={refine}
                disabled={!Object.values(answers).some((a) => a.trim())}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
                Refine estimate
              </button>
            </div>
          )}

          <ItemsEditor items={items} onChange={setItems} />

          <div className="flex items-baseline justify-between rounded-2xl bg-stone-100 px-4 py-3">
            <span className="text-sm text-stone-500">Total</span>
            <span>
              <strong>{Math.round(totals.calories)} kcal</strong>
              <span className="ml-2 text-xs text-stone-500">
                P {totals.protein_g}g · C {totals.carbs_g}g · F {totals.fat_g}g
              </span>
            </span>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="button" onClick={() => void save()} disabled={saving || items.length === 0}
            className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-40">
            {saving ? "Saving…" : "Save meal"}
          </button>
          <button type="button" onClick={() => setPhase("input")} className="w-full py-2 text-sm text-stone-500 underline">
            Back
          </button>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds, `/add` route listed.

- [ ] **Step 3: Manual smoke test (no Groq key needed for manual path)**

With dev server running, log in in a browser at `http://localhost:3000`, go to `/add`, use "Enter manually instead", fill an item, save. Expect redirect to `/`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add-meal flow with AI analysis, clarifications, and manual fallback"
```

---

### Task 11: Dashboard

**Files:**
- Create: `src/components/MacroSummary.tsx`, `src/components/MealCard.tsx`, `src/components/RelogButton.tsx`
- Modify: `src/app/(app)/page.tsx` (replace placeholder)

- [ ] **Step 1: Write `src/components/MacroSummary.tsx`**

```tsx
import type { NutritionTotals } from "@/lib/nutrition";
import type { SettingsRow } from "@/lib/db/queries";

function Meter({ label, value, target, unit }: { label: string; value: number; target: number | null; unit: string }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="flex-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-stone-500">{label}</span>
        <span className="font-medium text-stone-700">
          {Math.round(value)}
          {target ? `/${Math.round(target)}` : ""}{unit}
        </span>
      </div>
      {target && (
        <div className="mt-1 h-1.5 rounded-full bg-stone-200">
          <div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default function MacroSummary({ totals, prefs }: { totals: NutritionTotals; prefs: SettingsRow }) {
  const over = prefs.calorieTarget != null && totals.calories > prefs.calorieTarget;
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold">{Math.round(totals.calories).toLocaleString()}</span>
        <span className="text-sm text-stone-500">
          kcal today{prefs.calorieTarget ? ` · target ${Math.round(prefs.calorieTarget).toLocaleString()}` : ""}
        </span>
      </div>
      {prefs.calorieTarget != null && (
        <div className="mt-2 h-2 rounded-full bg-stone-200">
          <div
            className="h-2 rounded-full bg-emerald-600"
            style={{ width: `${Math.min(100, (totals.calories / prefs.calorieTarget) * 100)}%` }}
          />
        </div>
      )}
      {over && <p className="mt-1 text-xs text-stone-500">A little over today — that's okay, it's just information.</p>}
      <div className="mt-3 flex gap-4">
        <Meter label="Protein" value={totals.protein_g} target={prefs.proteinTarget} unit="g" />
        <Meter label="Carbs" value={totals.carbs_g} target={prefs.carbsTarget} unit="g" />
        <Meter label="Fat" value={totals.fat_g} target={prefs.fatTarget} unit="g" />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `src/components/MealCard.tsx`**

```tsx
import Link from "next/link";
import type { MealWithItems } from "@/lib/db/queries";

export default function MealCard({ meal }: { meal: MealWithItems }) {
  const kcal = Math.round(meal.items.reduce((a, i) => a + i.calories, 0));
  const title = meal.aiSummary || meal.items.map((i) => i.foodName).join(", ") || meal.description || "Meal";
  return (
    <Link
      href={`/meals/${meal.id}`}
      className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm"
    >
      {meal.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={meal.thumbnail} alt="" className="h-14 w-14 rounded-xl object-cover" />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-stone-100 text-2xl" aria-hidden>
          🍽️
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs capitalize text-stone-500">{meal.mealType}</p>
      </div>
      <span className="text-sm font-semibold">{kcal} kcal</span>
    </Link>
  );
}
```

- [ ] **Step 3: Write `src/components/RelogButton.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FoodItem } from "@/lib/ai/schema";

export default function RelogButton({
  mealType,
  aiSummary,
  thumbnail,
  items,
}: {
  mealType: string;
  aiSummary: string | null;
  thumbnail: string | null;
  items: FoodItem[];
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function relog() {
    setBusy(true);
    await fetch("/api/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mealType, inputType: "manual", thumbnail, aiSummary, items }),
    }).catch(() => null);
    setBusy(false);
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={() => void relog()}
      disabled={busy}
      className="rounded-full border border-emerald-600 px-3 py-1 text-xs font-medium text-emerald-700 disabled:opacity-50"
    >
      {busy ? "Logging…" : "Log again"}
    </button>
  );
}
```

- [ ] **Step 4: Replace `src/app/(app)/page.tsx`**

```tsx
import Link from "next/link";
import MacroSummary from "@/components/MacroSummary";
import MealCard from "@/components/MealCard";
import RelogButton from "@/components/RelogButton";
import { dbItemToFoodItem } from "@/lib/convert";
import { getMealsByDate, getRecentMeals, getSettings } from "@/lib/db/queries";
import { formatDisplayDate, todayString } from "@/lib/dates";
import { calcTotals } from "@/lib/nutrition";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const today = todayString();
  const [mealsToday, recent, prefs] = await Promise.all([
    getMealsByDate(today),
    getRecentMeals(8),
    getSettings(),
  ]);
  const totals = calcTotals(mealsToday.flatMap((m) => m.items.map(dbItemToFoodItem)));
  const recentOther = recent.filter((m) => m.loggedDate !== today).slice(0, 3);

  return (
    <main className="space-y-4 p-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Today</h1>
        <span className="text-sm text-stone-500">{formatDisplayDate(today)}</span>
      </header>

      <MacroSummary totals={totals} prefs={prefs} />

      <Link
        href="/add"
        className="block w-full rounded-xl bg-emerald-600 py-3 text-center font-semibold text-white shadow-sm"
      >
        📸 Add meal
      </Link>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-stone-500">Today's meals</h2>
        {mealsToday.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">
            Nothing logged yet — snap your next meal!
          </p>
        ) : (
          mealsToday.map((m) => <MealCard key={m.id} meal={m} />)
        )}
      </section>

      {recentOther.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-stone-500">Recent meals</h2>
          {recentOther.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <MealCard meal={m} />
              </div>
              <RelogButton
                mealType={m.mealType}
                aiSummary={m.aiSummary}
                thumbnail={m.thumbnail}
                items={m.items.map(dbItemToFoodItem)}
              />
            </div>
          ))}
        </section>
      )}

      <p className="text-center text-xs text-stone-400">All numbers are AI estimates — edit anything that looks off.</p>
    </main>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npm run build`
Expected: build succeeds. Then in the browser: dashboard shows the manually logged meal from Task 10 with totals.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: dashboard with daily totals, meal list, and re-logging"
```

---

### Task 12: History + trend chart

**Files:**
- Create: `src/components/TrendChart.tsx`, `src/app/(app)/history/page.tsx`

Chart follows dataviz rules: single series → no legend; one hue (today emphasized in a darker step of the same hue); rounded data-ends with a square baseline (clip trick); labels/values in ink colors, never the series color; selective direct label (today only); native `<title>` tooltips; dashed neutral target line.

- [ ] **Step 1: Write `src/components/TrendChart.tsx`**

```tsx
import { weekdayLetter } from "@/lib/dates";

export default function TrendChart({
  data,
  target,
}: {
  data: { date: string; calories: number }[];
  target: number | null;
}) {
  const W = 340;
  const H = 150;
  const PAD_TOP = 22;
  const PAD_BOTTOM = 20;
  const baseline = H - PAD_BOTTOM;
  const max = Math.max(target ?? 0, ...data.map((d) => d.calories), 1);
  const y = (v: number) => PAD_TOP + (baseline - PAD_TOP) * (1 - v / max);
  const slot = W / data.length;
  const barW = Math.min(28, slot - 8);
  const last = data.length - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Calories over the last 7 days" className="w-full">
      <clipPath id="trend-clip">
        <rect x="0" y="0" width={W} height={baseline} />
      </clipPath>
      <line x1="0" x2={W} y1={baseline} y2={baseline} stroke="#e7e5e4" strokeWidth="1" />
      {target != null && (
        <g>
          <line x1="0" x2={W} y1={y(target)} y2={y(target)} stroke="#a8a29e" strokeWidth="1" strokeDasharray="4 3" />
          <text x={W - 2} y={y(target) - 4} textAnchor="end" fontSize="9" fill="#78716c">
            target
          </text>
        </g>
      )}
      <g clipPath="url(#trend-clip)">
        {data.map((d, i) => {
          const x = i * slot + (slot - barW) / 2;
          const barY = y(d.calories);
          const h = baseline - barY;
          return (
            <g key={d.date}>
              <title>{`${d.date}: ${Math.round(d.calories)} kcal`}</title>
              <rect x={x} y={barY} width={barW} height={h + 4} rx="4" fill={i === last ? "#059669" : "#34d399"} />
            </g>
          );
        })}
      </g>
      {data.map((d, i) => (
        <text key={d.date} x={i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#78716c">
          {weekdayLetter(d.date)}
        </text>
      ))}
      {data[last] && data[last].calories > 0 && (
        <text
          x={last * slot + slot / 2}
          y={y(data[last].calories) - 6}
          textAnchor="middle"
          fontSize="10"
          fontWeight="600"
          fill="#44403c"
        >
          {Math.round(data[last].calories)}
        </text>
      )}
    </svg>
  );
}
```

- [ ] **Step 2: Write `src/app/(app)/history/page.tsx`**

```tsx
import Link from "next/link";
import TrendChart from "@/components/TrendChart";
import { dbItemToFoodItem } from "@/lib/convert";
import { getAllMealsWithItems, getSettings } from "@/lib/db/queries";
import { formatDisplayDate, lastNDates } from "@/lib/dates";
import { calcTotals, type NutritionTotals } from "@/lib/nutrition";

export const dynamic = "force-dynamic";

type DayBucket = { items: ReturnType<typeof dbItemToFoodItem>[]; count: number };

export default async function HistoryPage() {
  const [meals, prefs] = await Promise.all([getAllMealsWithItems(), getSettings()]);

  const byDate = new Map<string, DayBucket>();
  for (const meal of meals) {
    const bucket = byDate.get(meal.loggedDate) ?? { items: [], count: 0 };
    bucket.items.push(...meal.items.map(dbItemToFoodItem));
    bucket.count += 1;
    byDate.set(meal.loggedDate, bucket);
  }
  const totalsFor = new Map<string, NutritionTotals>(
    [...byDate.entries()].map(([date, bucket]) => [date, calcTotals(bucket.items)]),
  );

  const chartData = lastNDates(7).map((date) => ({
    date,
    calories: totalsFor.get(date)?.calories ?? 0,
  }));
  const days = [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <main className="space-y-4 p-4">
      <h1 className="text-xl font-bold">History</h1>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-stone-500">Last 7 days · kcal</h2>
        <TrendChart data={chartData} target={prefs.calorieTarget} />
      </section>

      {days.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">
          No meals logged yet.
        </p>
      ) : (
        <section className="space-y-2">
          {days.map(([date, info]) => {
            const totals = totalsFor.get(date)!;
            return (
              <div key={date} className="flex items-baseline justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
                <div>
                  <p className="text-sm font-medium">{formatDisplayDate(date)}</p>
                  <p className="text-xs text-stone-500">
                    {info.count} meal{info.count === 1 ? "" : "s"} · P {totals.protein_g}g · C {totals.carbs_g}g · F {totals.fat_g}g
                  </p>
                </div>
                <span className="font-semibold">{Math.round(totals.calories)} kcal</span>
              </div>
            );
          })}
        </section>
      )}

      <p className="text-center text-xs text-stone-400">
        Trends are for awareness, not judgement. <Link href="/settings" className="underline">Adjust targets</Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: build succeeds. In the browser: `/history` shows the chart with logged data and day cards.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: history page with 7-day calorie trend chart"
```

---

### Task 13: Meal detail page

**Files:**
- Create: `src/components/MealEditor.tsx`, `src/components/DeleteMealButton.tsx`, `src/app/(app)/meals/[id]/page.tsx`

- [ ] **Step 1: Write `src/components/MealEditor.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ItemsEditor from "@/components/ItemsEditor";
import type { FoodItem } from "@/lib/ai/schema";
import { calcTotals } from "@/lib/nutrition";

export default function MealEditor({ mealId, initialItems }: { mealId: string; initialItems: FoodItem[] }) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<FoodItem[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const totals = calcTotals(items);

  async function saveEdits() {
    if (items.length === 0 || items.some((i) => !i.food_name.trim())) {
      setError("Keep at least one item, and give every item a name.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/meals/${mealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    }).catch(() => null);
    setSaving(false);
    if (res?.ok) {
      setEditing(false);
      router.refresh();
    } else {
      setError("Couldn't save changes — try again.");
    }
  }

  return (
    <div className="space-y-3">
      {editing ? (
        <>
          <ItemsEditor items={items} onChange={setItems} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => void saveEdits()} disabled={saving}
              className="flex-1 rounded-xl bg-emerald-600 py-2.5 font-semibold text-white disabled:opacity-50">
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button type="button" onClick={() => { setItems(initialItems); setEditing(false); setError(""); }}
              className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm">
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{item.food_name}</span>
                  <span className="text-sm font-semibold">{Math.round(item.calories)} kcal</span>
                </div>
                <p className="text-xs text-stone-500">
                  {item.quantity_desc}
                  {item.grams ? ` · ${Math.round(item.grams)}g` : ""} · P {item.protein_g}g · C {item.carbs_g}g · F {item.fat_g}g
                </p>
                {item.assumptions.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-xs text-stone-400">
                    {item.assumptions.map((a, j) => (
                      <li key={j}>{a}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between rounded-2xl bg-stone-100 px-4 py-3">
            <span className="text-sm text-stone-500">Total</span>
            <span>
              <strong>{Math.round(totals.calories)} kcal</strong>
              <span className="ml-2 text-xs text-stone-500">
                P {totals.protein_g}g · C {totals.carbs_g}g · F {totals.fat_g}g
              </span>
            </span>
          </div>
          <button type="button" onClick={() => setEditing(true)}
            className="w-full rounded-xl border border-stone-300 py-2.5 text-sm font-medium">
            ✏️ Edit items
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/DeleteMealButton.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteMealButton({ mealId }: { mealId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function del() {
    if (!confirm("Delete this meal?")) return;
    setBusy(true);
    const res = await fetch(`/api/meals/${mealId}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      router.push("/");
      router.refresh();
    }
  }
  return (
    <button type="button" onClick={() => void del()} disabled={busy}
      className="w-full py-2 text-sm text-red-600 underline disabled:opacity-50">
      {busy ? "Deleting…" : "Delete meal"}
    </button>
  );
}
```

- [ ] **Step 3: Write `src/app/(app)/meals/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import DeleteMealButton from "@/components/DeleteMealButton";
import MealEditor from "@/components/MealEditor";
import { dbItemToFoodItem } from "@/lib/convert";
import { getMealWithItems } from "@/lib/db/queries";
import { formatDisplayDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function MealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meal = await getMealWithItems(id);
  if (!meal) notFound();

  return (
    <main className="space-y-4 p-4">
      <header>
        <h1 className="text-xl font-bold">{meal.aiSummary || "Meal"}</h1>
        <p className="text-sm capitalize text-stone-500">
          {meal.mealType} · {formatDisplayDate(meal.loggedDate)}
        </p>
      </header>

      {meal.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={meal.thumbnail} alt="Meal photo" className="w-full rounded-2xl" />
      )}

      {meal.description && <p className="text-sm text-stone-600">“{meal.description}”</p>}

      <MealEditor mealId={meal.id} initialItems={meal.items.map(dbItemToFoodItem)} />

      <p className="text-center text-xs text-stone-400">Estimates only — edit anything that looks off.</p>
      <DeleteMealButton mealId={meal.id} />
    </main>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: build succeeds. In the browser: open a meal from the dashboard, edit an item's calories, save, confirm the dashboard total changes; delete a test meal.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: meal detail with post-save editing and delete"
```

---

### Task 14: Settings page

**Files:**
- Create: `src/components/SettingsForm.tsx`, `src/components/LogoutButton.tsx`, `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Write `src/components/SettingsForm.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SettingsRow } from "@/lib/db/queries";

function TargetField({ label, value, onChange, unit }: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  unit: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value ?? ""}
          placeholder="—"
          onChange={(e) => onChange(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
          className="w-24 rounded-lg border border-stone-300 px-2 py-1.5 text-right text-sm"
        />
        <span className="text-xs text-stone-500">{unit}</span>
      </span>
    </label>
  );
}

export default function SettingsForm({ initial }: { initial: SettingsRow }) {
  const [calorieTarget, setCalorieTarget] = useState(initial.calorieTarget);
  const [proteinTarget, setProteinTarget] = useState(initial.proteinTarget);
  const [carbsTarget, setCarbsTarget] = useState(initial.carbsTarget);
  const [fatTarget, setFatTarget] = useState(initial.fatTarget);
  const [status, setStatus] = useState<"" | "saving" | "saved" | "error">("");
  const router = useRouter();

  async function save() {
    setStatus("saving");
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        calorieTarget: calorieTarget || null,
        proteinTarget: proteinTarget || null,
        carbsTarget: carbsTarget || null,
        fatTarget: fatTarget || null,
      }),
    }).catch(() => null);
    if (res?.ok) {
      setStatus("saved");
      router.refresh();
    } else {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-3">
      <TargetField label="Daily calories" value={calorieTarget} onChange={setCalorieTarget} unit="kcal" />
      <TargetField label="Protein" value={proteinTarget} onChange={setProteinTarget} unit="g" />
      <TargetField label="Carbs" value={carbsTarget} onChange={setCarbsTarget} unit="g" />
      <TargetField label="Fat" value={fatTarget} onChange={setFatTarget} unit="g" />
      <button type="button" onClick={() => void save()} disabled={status === "saving"}
        className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-50">
        {status === "saving" ? "Saving…" : "Save targets"}
      </button>
      {status === "saved" && <p className="text-center text-sm text-emerald-700">Saved ✓</p>}
      {status === "error" && <p className="text-center text-sm text-red-600">Couldn't save — try again.</p>}
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/LogoutButton.tsx`**

```tsx
"use client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => null);
    router.push("/login");
    router.refresh();
  }
  return (
    <button type="button" onClick={() => void logout()} className="w-full py-2 text-sm text-stone-500 underline">
      Log out
    </button>
  );
}
```

- [ ] **Step 3: Write `src/app/(app)/settings/page.tsx`**

```tsx
import LogoutButton from "@/components/LogoutButton";
import SettingsForm from "@/components/SettingsForm";
import { getSettings } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const prefs = await getSettings();
  const model = process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
  return (
    <main className="space-y-4 p-4">
      <h1 className="text-xl font-bold">Settings</h1>
      <p className="text-sm text-stone-500">
        Targets are optional — they're here for awareness, not restriction. Clear a field to remove its target.
      </p>
      <SettingsForm initial={prefs} />
      <div className="rounded-2xl bg-stone-100 p-3 text-xs text-stone-500">
        <p>AI model: {model}</p>
        <p className="mt-1">
          All nutrition numbers in this app are AI estimates for personal awareness — not medical or dietary advice.
        </p>
      </div>
      <LogoutButton />
    </main>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: build succeeds. In the browser: set a calorie target, save, confirm dashboard shows the progress bar; log out and confirm redirect to login.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: settings page with optional targets and logout"
```

---

### Task 15: PWA manifest + icons

**Files:**
- Create: `src/app/manifest.ts`, `public/icon.svg`, `src/app/apple-icon.tsx`

- [ ] **Step 1: Write `src/app/manifest.ts`**

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BiteLog",
    short_name: "BiteLog",
    description: "Personal AI meal logging — estimates only, always editable.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#059669",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
```

- [ ] **Step 2: Write `public/icon.svg`** (simple plate mark, emerald on white)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="104" fill="#059669"/>
  <circle cx="256" cy="256" r="150" fill="#fafaf9"/>
  <circle cx="256" cy="256" r="92" fill="none" stroke="#059669" stroke-width="14"/>
  <circle cx="256" cy="256" r="34" fill="#059669"/>
</svg>
```

- [ ] **Step 3: Write `src/app/apple-icon.tsx`** (generated PNG for iOS home screen)

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#059669",
        }}
      >
        <div
          style={{
            width: 106,
            height: 106,
            borderRadius: 9999,
            background: "#fafaf9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 9999,
              border: "10px solid #059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 24, height: 24, borderRadius: 9999, background: "#059669" }} />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: build succeeds; `/manifest.webmanifest` and `/apple-icon.png` appear in the route list. With dev server: `curl -s http://localhost:3000/manifest.webmanifest` returns the JSON (no auth redirect — middleware excludes it).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: PWA manifest and app icons"
```

---

### Task 16: README + final verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
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
```

- [ ] **Step 2: Run the full verification suite**

```bash
npm test
npm run build
```
Expected: all tests PASS; production build succeeds with all routes.

- [ ] **Step 3: Manual end-to-end checklist** (dev server + browser; needs `GROQ_API_KEY` for the AI paths — if the user hasn't provided one yet, verify the manual-entry path and record the AI paths as pending user verification)

- [ ] Login with wrong password → error; right password → dashboard
- [ ] Add meal by text description → items appear, editable → save → dashboard totals update
- [ ] Add meal by photo → thumbnail shown → analysis → save → thumbnail on dashboard card
- [ ] Clarification question answered → estimate re-runs
- [ ] Manual entry with empty `GROQ_API_KEY` → still works
- [ ] Edit a saved meal's calories → dashboard total changes
- [ ] Delete a meal → gone from dashboard
- [ ] Set calorie target → progress bar appears on dashboard; history chart shows target line
- [ ] Log out → redirected to login; API returns 401 without cookie

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: README with setup and deployment guide"
```

---

## Plan self-review notes

- **Spec coverage:** login/dashboard/add/results/history/detail/settings ✓; AI pipeline with retry + clarifications + manual fallback ✓; thumbnails-in-DB ✓; password gate ✓; safety framing (copy in add/results/settings/dashboard) ✓; tests ✓; Vercel+Turso deployment (README) ✓; PWA manifest ✓. Deviations listed in the header.
- **Type consistency:** `FoodItem` (snake_case) is the single client-side item shape; DB rows are camelCase; `convert.ts` is the only bridge. `NutritionTotals` used in add flow, dashboard, history, meal editor.

