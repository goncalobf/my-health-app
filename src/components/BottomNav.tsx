"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Dumbbell, Apple, LineChart, Brain } from "lucide-react";

const TABS = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/nutrition", label: "Nutrition", icon: Apple },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/coach", label: "Coach", icon: Brain },
];

export default function BottomNav() {
  const pathname = usePathname();
  const activeWorkout = /^\/workouts\/session\/[^/]+$/.test(pathname);

  if (activeWorkout) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-2 pb-2 safe-bottom" aria-label="Primary navigation">
      <div className="mx-auto grid max-w-xl grid-cols-5 border border-border bg-bg/95 p-1 shadow-[0_-14px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl [border-radius:2px_14px_2px_2px]">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={true}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-w-0 flex-col items-center gap-1 px-0.5 py-2.5 font-display text-[11px] tracking-[0.07em] transition min-[360px]:text-xs ${
                active ? "bg-accent text-bg [border-radius:1px_9px_1px_1px]" : "text-muted hover:text-text"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="w-full truncate text-center">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
