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
