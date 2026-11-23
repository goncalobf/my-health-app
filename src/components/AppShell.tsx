"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Apple, ChartNoAxesCombined, Dumbbell, House, Settings, Sparkles, Users } from "lucide-react";
import BrandMark from "./BrandMark";

const primary = [
  { href: "/", label: "Home", icon: House },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/nutrition", label: "Nutrition", icon: Apple },
  { href: "/progress", label: "Progress", icon: ChartNoAxesCombined },
  { href: "/coach", label: "Coach", icon: Sparkles },
];
const secondary = [
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeWorkout = /^\/workouts\/session\/[^/]+$/.test(pathname);
  const widePage = primary.some(({ href }) => pathname === href) && pathname !== "/coach";
  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  return (
    <div className={`min-h-dvh ${activeWorkout ? "" : "min-[880px]:pl-[14rem]"}`}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-surface focus:p-3 focus:text-accent"
      >
        Skip to content
      </a>
      {!activeWorkout && (
        <>
          <aside className="fixed inset-y-0 left-0 z-40 hidden w-[14rem] flex-col overflow-y-auto border-r border-border bg-surface px-4 py-7 min-[880px]:flex">
            <Link href="/" className="mb-10 ml-2 w-fit" aria-label="Fitlog home"><BrandMark /></Link>
            <nav aria-label="Primary navigation" className="flex flex-col gap-1.5">
              {primary.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${isActive(href) ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-text"}`}
                >
                  <Icon size={19} aria-hidden="true" /> {label}
                </Link>
              ))}
            </nav>
            <nav aria-label="Account navigation" className="mt-auto flex flex-col gap-1.5 border-t border-border pt-4">
              {secondary.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${isActive(href) ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-text"}`}
                >
                  <Icon size={19} aria-hidden="true" /> {label}
                </Link>
              ))}
            </nav>
          </aside>
          <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md safe-bottom min-[880px]:hidden" aria-label="Primary navigation">
            <div className="mx-auto grid max-w-xl grid-cols-5 px-1 py-1.5">
              {primary.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={`flex min-w-0 flex-col items-center gap-0.5 px-0.5 py-0.5 text-[10px] leading-normal min-[375px]:text-[11px] ${isActive(href) ? "font-extrabold text-accent" : "font-semibold text-muted"}`}
                >
                  <span className={`flex h-8 w-12 items-center justify-center rounded-full ${isActive(href) ? "bg-accent-soft" : ""}`}>
                    <Icon size={18} strokeWidth={isActive(href) ? 2.25 : 1.8} aria-hidden="true" />
                  </span>
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          </nav>
        </>
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className={`relative mx-auto w-full px-4 pb-28 pt-[calc(1.125rem+env(safe-area-inset-top))] min-[520px]:px-6 min-[880px]:px-8 min-[880px]:pb-12 min-[880px]:pt-9 ${widePage ? "max-w-6xl" : "max-w-2xl"}`}
      >
        {children}
      </main>
    </div>
  );
}
