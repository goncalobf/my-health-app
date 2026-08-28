"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, History } from "lucide-react";
import { apiGet } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { formatDate } from "@/lib/utils";

interface SessionRow {
  id: number;
  name: string;
  startedAt: string;
  finishedAt: string | null;
}

export default function HistoryPage() {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<SessionRow[]>("/api/sessions").then((r) => {
      setRows(r);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader title="History" back="/workouts" />
      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card p-6 flex flex-col items-center text-center gap-3">
          <History className="text-muted" size={32} />
          <p className="text-muted text-sm">No workouts logged yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((s) => (
            <Link
              key={s.id}
              href={`/workouts/session/${s.id}`}
              className="card p-4 flex items-center justify-between active:scale-[0.98] transition"
            >
              <div>
                <p className="font-semibold">{s.name}</p>
                <p className="text-xs text-muted">
                  {formatDate(
                    new Date(s.startedAt).toISOString().slice(0, 10)
                  )}
                  {!s.finishedAt && (
                    <span className="text-accent"> · in progress</span>
                  )}
                </p>
              </div>
              <ChevronRight className="text-muted" size={20} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
