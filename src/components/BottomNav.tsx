"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Today" },
  { href: "/add", label: "Add" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`py-4 text-center font-display text-[11px] uppercase tracking-[0.18em] ${
                active ? "text-tomato" : "text-ink-soft"
              }`}
            >
              <span className={`border-b-2 pb-1 ${active ? "border-tomato" : "border-transparent"}`}>
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
