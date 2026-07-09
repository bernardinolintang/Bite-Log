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
        Targets are optional — they&apos;re here for awareness, not restriction. Clear a field to remove its target.
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
