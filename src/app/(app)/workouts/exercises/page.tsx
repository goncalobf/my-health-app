"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import PageHeader from "@/components/PageHeader";

interface Exercise {
  id: number;
  name: string;
  muscleGroup: string | null;
}

const MUSCLES = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Calves",
  "Core",
  "Other",
];

export default function ExercisesPage() {
  const [list, setList] = useState<Exercise[]>([]);
  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState("Chest");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    setList(await apiGet<Exercise[]>("/api/exercises"));
  }
  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      await apiPost("/api/exercises", { name: name.trim(), muscleGroup: muscle });
      setName("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this exercise? Its history stays in past sessions."))
      return;
    await apiDelete(`/api/exercises/${id}`);
    setList((l) => l.filter((x) => x.id !== id));
  }

  const filtered = list.filter((x) =>
    x.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="Exercises" back="/workouts" />

      <form onSubmit={add} className="card p-4 flex flex-col gap-3 mb-4">
        <input
          className="input"
          placeholder="Exercise name (e.g. Bench Press)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {MUSCLES.map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => setMuscle(m)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm border ${
                muscle === m
                  ? "bg-accent text-bg border-accent"
                  : "bg-surface-2 text-muted border-border"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <button className="btn-primary" disabled={adding || !name.trim()}>
          <Plus size={18} /> Add exercise
        </button>
      </form>

      {list.length > 5 && (
        <div className="relative mb-3">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            className="input pl-10"
            placeholder="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((x) => (
          <div key={x.id} className="card px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="font-medium">{x.name}</p>
              {x.muscleGroup && (
                <p className="text-xs text-muted">{x.muscleGroup}</p>
              )}
            </div>
            <button
              onClick={() => remove(x.id)}
              className="text-muted p-2"
              aria-label="Delete"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {list.length === 0 && (
          <p className="text-muted text-sm text-center py-6">
            No exercises yet. Add your first above.
          </p>
        )}
      </div>
    </div>
  );
}
