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
