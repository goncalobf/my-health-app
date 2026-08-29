export default function AppLoading() {
  return (
    <div
      className="flex animate-pulse flex-col gap-6"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-[0.22em] text-muted">
        <span className="h-px w-8 bg-accent" /> Fitlog / loading protocol
      </div>
      <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-2">
          <div className="h-2 w-24 bg-surface-2" />
          <div className="h-10 w-44 bg-surface-2 [border-radius:2px_10px_2px_2px]" />
        </div>
        <div className="h-11 w-11 bg-surface-2 [border-radius:2px_10px_2px_2px]" />
      </div>
      <div className="card h-72 bg-surface-2/50" />
      <div className="grid grid-cols-2 gap-3">
        <div className="card h-36 bg-surface-2/50" />
        <div className="card h-36 bg-surface-2/50" />
      </div>
      <div className="card h-40 bg-surface-2/50" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
