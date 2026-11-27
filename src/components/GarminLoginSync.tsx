"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type SyncStatus = "idle" | "syncing" | "synced" | "partial" | "failed";
type SyncResult = { imported: number; incomplete: boolean };

const GarminLoginSyncContext = createContext<{
  status: SyncStatus;
  revision: number;
  sync: () => Promise<SyncResult>;
}>({
  status: "idle",
  revision: 0,
  sync: async () => { throw new Error("Garmin sync is unavailable."); },
});

export const GARMIN_PARTIAL_MESSAGE = "Some Garmin health data couldn’t sync. Tap Sync now to retry.";

export function useGarminLoginSync() {
  return useContext(GarminLoginSyncContext);
}

async function requestSync(onLogin: boolean, isMounted: () => boolean, refresh: () => void): Promise<SyncResult> {
  const deadline = Date.now() + 65_000;
  const url = onLogin ? "/api/garmin/sync?trigger=login" : "/api/garmin/sync";
  let retriedPartial = false;
  let imported = 0;

  while (isMounted() && Date.now() < deadline) {
    const response = await fetch(url, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
    }).catch(() => null);
    if (!response) {
      if (retriedPartial) return { imported, incomplete: true };
      throw new Error("Couldn’t reach Fitlog to sync Garmin. Try again.");
    }
    if (response.status === 204) {
      refresh();
      return { imported, incomplete: false };
    }
    const body = await response.json().catch(() => ({}));
    const busy = response.status === 409 && body.code === "sync_busy";
    if (response.ok) {
      imported += body.imported ?? 0;
      refresh();
      if (!body.incomplete || !onLogin || retriedPartial || Date.now() >= deadline) {
        return { imported, incomplete: Boolean(body.incomplete) };
      }
      retriedPartial = true;
    } else if (!onLogin || !busy || Date.now() >= deadline) {
      if (retriedPartial) return { imported, incomplete: true };
      throw new Error(body.error ?? "Garmin sync failed. Try again.");
    }
    await new Promise((resolve) => window.setTimeout(resolve, 2_000));
  }
  if (retriedPartial) return { imported, incomplete: true };
  throw new Error("Garmin sync took too long. Try again.");
}

export default function GarminLoginSync({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const router = useRouter();
  const started = useRef(false);
  const mounted = useRef(false);
  const inFlight = useRef<Promise<SyncResult> | null>(null);
  const [status, setStatus] = useState<SyncStatus>(enabled ? "syncing" : "idle");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = useCallback((onLogin: boolean) => {
    if (inFlight.current) return inFlight.current;
    const request = requestSync(onLogin, () => mounted.current, () => {
      if (!mounted.current) return;
      setRevision((current) => current + 1);
      router.refresh();
    }).then((result) => {
      if (mounted.current) setStatus(result.incomplete ? "partial" : "synced");
      return result;
    }).catch((error) => {
      if (mounted.current) setStatus("failed");
      throw error;
    }).finally(() => {
      inFlight.current = null;
    });

    inFlight.current = request;
    return request;
  }, [router]);

  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    void run(true).catch(() => {});
  }, [enabled, run]);

  function sync() {
    setStatus("syncing");
    return run(false);
  }

  return <GarminLoginSyncContext.Provider value={{ status, revision, sync }}>{children}</GarminLoginSyncContext.Provider>;
}
