"use client";

import { useEffect, useRef, useState } from "react";
import { Link2, Link2Off, RefreshCw, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { apiGet } from "@/lib/api";

interface ConnectionStatus {
  connected: boolean;
  connectedAt: string | null;
  lastSyncedAt: string | null;
}

type AuthPhase =
  | "idle"
  | "connecting"  // calling Worker
  | "done"
  | "error";

export default function GarminSettings() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [phase, setPhase] = useState<AuthPhase>("idle");
  const [authError, setAuthError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncError, setSyncError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const s = await apiGet<ConnectionStatus>("/api/garmin/connect");
    setStatus(s);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function connect() {
    if (!username.trim() || !password) return;
    setPhase("connecting");
    setAuthError("");

    // 1. Create a session on the server
    const sessionRes = await fetch("/api/garmin/auth-session", { method: "POST" });
    if (!sessionRes.ok) {
      setPhase("error");
      setAuthError("Could not start auth session");
      return;
    }
    const { id: sessionId, secret } = await sessionRes.json() as { id: string; secret: string };

    // 2. Call the Cloudflare Worker — it logs into Garmin from a non-flagged IP
    const workerUrl = process.env.NEXT_PUBLIC_GARMIN_WORKER_URL;
    if (!workerUrl) {
      setPhase("error");
      setAuthError("Garmin auth worker is not configured");
      return;
    }

    // Call the Worker — if the network request itself fails (CORS, DNS, etc.)
    // surface it immediately rather than letting the poll spin forever.
    fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.trim(),
        password,
        sessionId,
        secret,
        callbackUrl: window.location.origin,
      }),
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      setPhase("error");
      setAuthError(`Could not reach the Garmin auth server — ${msg}`);
    });

    // 3. Poll for completion — give up after 90 s if the Worker never calls back
    const deadline = Date.now() + 90_000;
    pollRef.current = setInterval(async () => {
      if (Date.now() > deadline) {
        clearInterval(pollRef.current!);
        setPhase("error");
        setAuthError("Connection timed out — the auth server didn't respond. Please try again.");
        return;
      }
      const r = await fetch(`/api/garmin/auth-session/${sessionId}`);
      if (!r.ok) return;
      const { status: s, error } = await r.json() as { status: string; error?: string };

      if (s === "done") {
        clearInterval(pollRef.current!);
        setPhase("done");
        setUsername("");
        setPassword("");
        await load();
      } else if (s === "error") {
        clearInterval(pollRef.current!);
        setPhase("error");
        const msg = error ?? "Garmin login failed";
        setAuthError(
          msg.includes("MFA") || msg.includes("Ticket not found")
            ? "Garmin blocked this sign-in. Check your Garmin email for a security notification, then try again."
            : `Garmin login failed — ${msg}`
        );
      } else if (s === "expired") {
        clearInterval(pollRef.current!);
        setPhase("error");
        setAuthError("Session timed out. Please try again.");
      }
    }, 2000);
  }

  async function disconnect() {
    if (!confirm("Disconnect Garmin? Your imported activities will remain.")) return;
    await fetch("/api/garmin/connect", { method: "DELETE" });
    setStatus({ connected: false, connectedAt: null, lastSyncedAt: null });
    setPhase("idle");
  }

  async function sync() {
    setSyncing(true);
    setSyncResult(null);
    setSyncError("");
    try {
      const res = await fetch("/api/garmin/sync", { method: "POST" });
      const body = await res.json().catch(() => ({})) as { imported?: number; error?: string };
      if (!res.ok) { setSyncError(body.error ?? "Sync failed"); return; }
      setSyncResult(`${body.imported ?? 0} new activities imported`);
      await load();
    } catch {
      setSyncError("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (!status) return null;

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-muted mb-2">Garmin Connect</h2>
      <div className="card p-4 flex flex-col gap-4">

        {status.connected ? (
          <>
            <div className="flex items-center gap-3">
              <Link2 size={18} className="text-accent shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">Connected</p>
                {status.lastSyncedAt && (
                  <p className="text-xs text-muted">
                    Last synced {new Date(status.lastSyncedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button onClick={disconnect} className="btn-danger px-3 py-2 text-sm shrink-0">
                <Link2Off size={14} /> Disconnect
              </button>
            </div>

            <div className="flex items-start gap-2 rounded border border-border bg-surface-2 px-3 py-2.5">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-xs text-muted leading-relaxed">
                Your session token is encrypted with AES-256-GCM. It gives read-only access — it cannot change your Garmin password or account settings.
              </p>
            </div>

            <button onClick={sync} disabled={syncing} className="btn-ghost w-full">
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing…" : "Sync now"}
            </button>
            {syncResult && <p className="text-xs text-accent text-center">{syncResult}</p>}
            {syncError && <p className="rounded bg-danger/10 px-3 py-2 text-xs text-danger">{syncError}</p>}
          </>
        ) : (
          <>
            <label>
              <span className="label">Garmin email</span>
              <input
                className="input mt-1"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={phase === "connecting"}
              />
            </label>

            <label>
              <span className="label">Garmin password</span>
              <div className="relative mt-1">
                <input
                  className="input pr-12"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={phase === "connecting"}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <div className="flex items-start gap-2 rounded border border-border bg-surface-2 px-3 py-2.5">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-xs text-muted leading-relaxed">
                Your credentials are sent over HTTPS to a secure auth server and never stored — only the resulting session token is saved, encrypted with AES-256-GCM.
              </p>
            </div>

            {authError && (
              <p className="rounded bg-danger/10 px-3 py-2 text-xs text-danger">{authError}</p>
            )}

            {phase === "connecting" ? (
              <div className="flex items-center justify-center gap-3 py-2">
                <RefreshCw size={16} className="animate-spin text-accent" />
                <span className="text-sm text-muted">Getting Garmin token…</span>
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={!username.trim() || !password}
                className="btn-primary"
              >
                <Link2 size={16} />
                {phase === "error" ? "Try again" : "Connect Garmin"}
              </button>
            )}

            {phase === "done" && (
              <p className="text-sm text-accent text-center font-medium">Connected!</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
