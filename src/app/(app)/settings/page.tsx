import ExportButton from "@/components/ExportButton";
import SettingsForm from "@/components/SettingsForm";import { getSettings } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const prefs = await getSettings();
  const model = process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
  return (
    <main className="space-y-5 p-5">
      <header className="border-b-2 border-ink pb-3">
        <h1 className="font-display text-sm font-medium uppercase tracking-[0.25em]">Settings</h1>
      </header>
      <p className="text-sm italic text-ink-soft">
        Targets are optional — they&apos;re here for awareness, not restriction. Clear a field to remove its target.
      </p>
      <SettingsForm initial={prefs} />
      <ExportButton />
      <div className="border-t border-line pt-4 text-xs italic text-ink-soft">
        <p className="not-italic font-display text-[10px] uppercase tracking-[0.2em]">AI model</p>
        <p className="mt-1 not-italic">{model}</p>
        <p className="mt-3">
          All nutrition numbers in this app are AI estimates for personal awareness — not medical or dietary advice.
        </p>
      </div>
    </main>  );
}
