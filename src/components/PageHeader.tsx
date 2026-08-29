"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function PageHeader({
  title,
  back,
  action,
}: {
  title: string;
  back?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex min-h-14 min-w-0 items-center gap-3 border-b border-border pb-4">
      {back && (
        <Link
          href={back}
          className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-surface text-muted [border-radius:2px_10px_2px_2px]"
          aria-label="Go back"
        >
          <ChevronLeft size={24} />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.24em] text-accent">Fitlog / archive</p>
        <h1 className="truncate font-display text-3xl leading-none tracking-[0.04em] min-[360px]:text-4xl">{title}</h1>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
