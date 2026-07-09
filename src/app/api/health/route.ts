import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";

export async function GET() {
  const url = process.env.DATABASE_URL ?? "file:local.db";
  const hasToken = Boolean(process.env.DATABASE_AUTH_TOKEN);
  const onVercel = Boolean(process.env.VERCEL);
  const usingLocalFile = url.startsWith("file:");

  if (onVercel && usingLocalFile) {
    return NextResponse.json(
      {
        ok: false,
        error: "DATABASE_URL is set to a local file. Vercel needs a Turso libsql:// URL.",
        hint: "Create a Turso database, run npm run db:push, then set DATABASE_URL and DATABASE_AUTH_TOKEN in Vercel.",
      },
      { status: 500 },
    );
  }

  if (!usingLocalFile && !hasToken) {
    return NextResponse.json(
      {
        ok: false,
        error: "DATABASE_AUTH_TOKEN is missing. Turso requires an auth token.",
      },
      { status: 500 },
    );
  }

  try {
    const client = createClient({
      url,
      authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
    });
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const names = tables.rows.map((r) => r.name as string);
    const required = ["meals", "meal_items", "settings", "food_templates", "saved_meals"];
    const missing = required.filter((t) => !names.includes(t));
    if (missing.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Missing tables: ${missing.join(", ")}`,
          hint: "Run npm run db:push with your Turso DATABASE_URL in .env, then redeploy.",
          tables: names,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, tables: names });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Database connection failed",
        databaseUrlPrefix: url.slice(0, 20) + "…",
      },
      { status: 500 },
    );
  }
}
