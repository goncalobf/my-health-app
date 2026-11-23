export default function AppLoading() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading page">
      <div className="h-9 w-44 animate-pulse rounded-xl bg-accent-soft" />
      <div className="card h-40 animate-pulse bg-surface-2" />
      <div className="card h-28 animate-pulse bg-surface-2" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
