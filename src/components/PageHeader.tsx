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
    <header className="mb-4 flex min-h-10 min-w-0 items-center gap-2">
      {back && (
        <Link
          href={back}
          className="w-10 h-10 -ml-2 flex items-center justify-center text-muted"
        >
          <ChevronLeft size={24} />
        </Link>
      )}
      <h1 className="min-w-0 flex-1 truncate text-xl font-bold min-[360px]:text-2xl">
        {title}
      </h1>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
