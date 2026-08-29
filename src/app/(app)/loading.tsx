export default function AppLoading() {
  return (
    <div
      className="flex animate-pulse flex-col gap-5"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full w-1/2 rounded-full bg-accent/70" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-surface-2" />
          <div className="h-7 w-40 rounded bg-surface-2" />
        </div>
        <div className="h-10 w-10 rounded-full bg-surface-2" />
      </div>
      <div className="card h-32 bg-surface-2/50" />
      <div className="grid grid-cols-2 gap-3">
        <div className="card h-28 bg-surface-2/50" />
        <div className="card h-28 bg-surface-2/50" />
      </div>
      <div className="card h-40 bg-surface-2/50" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
