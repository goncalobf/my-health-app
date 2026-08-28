"use client";

import { useEffect, useState } from "react";
import { Search, Plus, X } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";

interface Exercise {
  id: number;
  name: string;
  muscleGroup: string | null;
  equipment: string | null;
  category: string | null;
}

const RESULT_LIMIT = 100;

export default function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (exerciseId: number) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<Exercise[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setList(await apiGet<Exercise[]>("/api/exercises"));
  }
  useEffect(() => {
    load();
  }, []);

  const query = q.trim().toLowerCase();
  const filtered = list.filter((x) =>
    [x.name, x.muscleGroup, x.equipment, x.category]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(query))
  );
  const visible = filtered.slice(0, RESULT_LIMIT);

  async function createAndPick() {
    if (!q.trim()) return;
    setBusy(true);
    try {
      const created = await apiPost<Exercise>("/api/exercises", {
        name: q.trim(),
      });
      onPick(created.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60">
      <div className="bg-surface rounded-t-2xl border-t border-border max-h-[80vh] flex flex-col safe-bottom">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <h3 className="font-semibold flex-1">Add exercise</h3>
          <button onClick={onClose} className="text-muted p-1">
            <X size={22} />
          </button>
        </div>
        <div className="p-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              autoFocus
              className="input pl-10"
              placeholder="Search or type a new one"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-y-auto px-4 pb-4 flex flex-col gap-2">
          {visible.map((x) => (
            <button
              key={x.id}
              onClick={() => onPick(x.id)}
              className="card px-4 py-3 flex items-center gap-3 text-left active:scale-[0.98] transition"
            >
              <div className="flex-1">
                <p className="font-medium">{x.name}</p>
                {(x.muscleGroup || x.equipment) && (
                  <p className="text-xs text-muted">
                    {[x.muscleGroup, x.equipment].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <Plus size={18} className="text-accent" />
            </button>
          ))}
          {q.trim() &&
            !filtered.some(
              (x) => x.name.toLowerCase() === q.trim().toLowerCase()
            ) && (
              <button
                onClick={createAndPick}
                disabled={busy}
                className="btn-primary mt-1"
              >
                <Plus size={18} /> Create &ldquo;{q.trim()}&rdquo;
              </button>
            )}
          {filtered.length > RESULT_LIMIT && (
            <p className="text-muted text-xs text-center py-2">
              Showing {RESULT_LIMIT} of {filtered.length}. Search by exercise,
              muscle, or equipment to narrow the list.
            </p>
          )}
          {list.length === 0 && !q && (
            <p className="text-muted text-sm text-center py-4">
              No exercises yet — type a name above to create one.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
