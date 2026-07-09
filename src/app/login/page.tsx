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
      <form onSubmit={submit} className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-5xl font-medium tracking-tight">
            BiteLog<span className="text-tomato">.</span>
          </h1>
          <p className="italic text-ink-soft">a quiet record of what you ate</p>
        </div>
        <div className="space-y-6">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full rounded-none border-0 border-b border-ink bg-transparent px-0 py-2 text-lg placeholder:text-ink-soft/60 focus:border-tomato focus:outline-none"
          />
          {error && <p className="text-sm italic text-tomato">{error}</p>}
          <button
            disabled={busy || !password}
            className="w-full rounded-none bg-tomato py-3.5 font-display text-sm uppercase tracking-[0.2em] text-paper disabled:opacity-50"
          >
            {busy ? "Checking…" : "Unlock"}
          </button>
        </div>
      </form>
    </main>
  );
}
