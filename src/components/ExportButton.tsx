"use client";

export default function ExportButton() {
  async function download() {
    const res = await fetch("/api/export").catch(() => null);
    if (!res?.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bitelog-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={() => void download()}
      className="w-full border border-ink py-2.5 font-display text-[11px] uppercase tracking-[0.2em] hover:bg-ink hover:text-paper"
    >
      Export my data
    </button>
  );
}
