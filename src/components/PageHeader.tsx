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
    <header className="flex items-center gap-2 mb-4 min-h-10">
      {back && (
        <Link
          href={back}
          className="w-10 h-10 -ml-2 flex items-center justify-center text-muted"
        >
          <ChevronLeft size={24} />
        </Link>
      )}
      <h1 className="text-2xl font-bold flex-1 truncate">{title}</h1>
      {action}
    </header>
  );
}
