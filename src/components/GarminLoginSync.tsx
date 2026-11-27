"use client";

import { useRouter } from "next/navigation";
import { GARMIN_SIGN_IN_PARAM } from "@/lib/garmin-sync-on-login";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type SyncStatus = "idle" | "syncing" | "synced" | "partial" | "failed";
type SyncResult = { imported: number; incomplete: boolean };
type SyncTrigger = "open" | "sign-in" | "manual";

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

async function requestSync(trigger: SyncTrigger, isMounted: () => boolean, refresh: () => void): Promise<SyncResult> {
  const deadline = Date.now() + 65_000;
  const automatic = trigger !== "manual";
  let waitedForSync = false;
  let retriedPartial = false;
  let imported = 0;

  while (isMounted() && Date.now() < deadline) {
    const params = new URLSearchParams();
    if (automatic) params.set("trigger", "login");
    if (trigger === "sign-in" && !retriedPartial) params.set("fresh", "1");
    const query = params.toString();
    const response = await fetch(query ? `/api/garmin/sync?${query}` : "/api/garmin/sync", {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
    }).catch(() => null);
    if (!response) {
      if (retriedPartial) return { imported, incomplete: true };
      throw new Error("Couldn’t reach Fitlog to sync Garmin. Try again.");
    }
    if (response.status === 204) {
      if (waitedForSync) refresh();
      return { imported, incomplete: false };
    }
    const body = await response.json().catch(() => ({}));
    const busy = response.status === 409 && body.code === "sync_busy";
    if (response.ok) {
      imported += body.imported ?? 0;
      refresh();
      if (!body.incomplete || !automatic || retriedPartial || Date.now() >= deadline) {
        return { imported, incomplete: Boolean(body.incomplete) };
      }
      retriedPartial = true;
    } else if (!automatic || !busy || Date.now() >= deadline) {
      if (retriedPartial) return { imported, incomplete: true };
      throw new Error(body.error ?? "Garmin sync failed. Try again.");
    } else {
      waitedForSync = true;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 2_000));
  }
  if (retriedPartial) return { imported, incomplete: true };
  throw new Error("Garmin sync took too long. Try again.");
}

export default function GarminLoginSync({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const router = useRouter();
  const lastAutoCheck = useRef<number | null>(null);
  const mounted = useRef(false);
  const inFlight = useRef<Promise<SyncResult> | null>(null);
  const [status, setStatus] = useState<SyncStatus>(enabled ? "syncing" : "idle");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = useCallback((trigger: SyncTrigger) => {
    if (inFlight.current) return inFlight.current;
    const request = requestSync(trigger, () => mounted.current, () => {
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
    if (!enabled) return;

    function checkWhenVisible() {
      if (!mounted.current || document.visibilityState !== "visible" || inFlight.current) return;
      const now = Date.now();
      if (lastAutoCheck.current !== null && now - lastAutoCheck.current < 60_000) return;
      lastAutoCheck.current = now;

      const url = new URL(window.location.href);
      const justSignedIn = url.searchParams.get(GARMIN_SIGN_IN_PARAM) === "1";
      if (justSignedIn) {
        url.searchParams.delete(GARMIN_SIGN_IN_PARAM);
        window.history.replaceState(null, "", url);
      }

      setStatus("syncing");
      void run(justSignedIn ? "sign-in" : "open").catch(() => {});
    }

    // A full sign-in landing, PWA resume, or back/forward cache restore can
    // each be the first time Fitlog is in the foreground.
    queueMicrotask(checkWhenVisible);
    document.addEventListener("visibilitychange", checkWhenVisible);
    window.addEventListener("pageshow", checkWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", checkWhenVisible);
      window.removeEventListener("pageshow", checkWhenVisible);
    };
  }, [enabled, run]);

  function sync() {
    setStatus("syncing");
    return run("manual");
  }

  return <GarminLoginSyncContext.Provider value={{ status, revision, sync }}>{children}</GarminLoginSyncContext.Provider>;
}
