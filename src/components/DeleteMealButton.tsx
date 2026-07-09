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
    <button
      type="button"
      onClick={() => void del()}
      disabled={busy}
      className="w-full py-2 text-sm text-red-600 underline disabled:opacity-50"
    >
      {busy ? "Deleting…" : "Delete meal"}
    </button>
  );
}
