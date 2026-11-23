"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { mobilityGroups, mobilityMinutes, searchMobilityRoutines } from "@/lib/mobility";

const groups = ["All", ...mobilityGroups] as const;

export default function MobilityPage() {
  const [group, setGroup] = useState<(typeof groups)[number]>("All");
  const [search, setSearch] = useState("");
  const routines = searchMobilityRoutines(search, group);

  return (
    <>
      <PageHeader title="Mobility & flexibility" back="/workouts" />
      <div className="relative mb-3">
        <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          aria-label="Search mobility routines"
          className="input pl-9"
          type="search"
          placeholder="Search hips, shoulders, jiu-jitsu…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter mobility routines">
        {groups.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setGroup(item)}
            aria-pressed={group === item}
            className={`${group === item ? "btn-primary" : "btn-ghost"} min-h-11 px-3 py-2 text-sm`}
          >
            {item}
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs text-muted" role="status">
        {routines.length} {routines.length === 1 ? "routine" : "routines"}
      </p>
      {routines.length ? (
        <ul className="space-y-2">
          {routines.map((routine) => (
            <li key={routine.id}>
              <Link href={`/workouts/mobility/${routine.id}`} className="card flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-accent">{routine.mode} · about {mobilityMinutes(routine)} min</p>
                  <h2 className="mt-1 break-words font-display text-2xl leading-none">{routine.name}</h2>
                  <p className="mt-1.5 text-sm text-muted">{routine.focus}</p>
                </div>
                <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="card p-4 text-sm text-muted">No matching routines. Try another search or body region.</p>}
    </>
  );
}
