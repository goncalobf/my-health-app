"use client";

import { useEffect, useRef, useState } from "react";
import { Link2, Link2Off, RefreshCw, ShieldCheck, Copy, Check } from "lucide-react";
import { apiGet } from "@/lib/api";

interface ConnectionStatus {
  connected: boolean;
  connectedAt: string | null;
  lastSyncedAt: string | null;
}

type AuthState =
  | { phase: "idle" }
  | { phase: "waiting"; command: string; sessionId: string }
  | { phase: "done" }
  | { phase: "expired" }
  | { phase: "error"; message: string };

export default function GarminSettings() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [auth, setAuth] = useState<AuthState>({ phase: "idle" });
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncError, setSyncError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual token paste fallback
  const [showManual, setShowManual] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [manualConnecting, setManualConnecting] = useState(false);
  const [manualError, setManualError] = useState("");

  async function load() {
    const s = await apiGet<ConnectionStatus>("/api/garmin/connect");
    setStatus(s);
  }

  useEffect(() => { load(); }, []);

  // Stop polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function startAuth() {
    setAuth({ phase: "idle" });
    if (pollRef.current) clearInterval(pollRef.current);

    const res = await fetch("/api/garmin/auth-session", { method: "POST" });
    if (!res.ok) { setAuth({ phase: "error", message: "Could not create auth session" }); return; }
    const { id, command } = await res.json() as { id: string; command: string };

    setAuth({ phase: "waiting", command, sessionId: id });

    // Poll every 2 s until the script completes or the session expires
    pollRef.current = setInterval(async () => {
      const pollRes = await fetch(`/api/garmin/auth-session/${id}`);
      if (!pollRes.ok) return;
      const { status: s } = await pollRes.json() as { status: string };
      if (s === "done") {
        clearInterval(pollRef.current!);
        setAuth({ phase: "done" });
        await load();
      } else if (s === "expired") {
        clearInterval(pollRef.current!);
        setAuth({ phase: "expired" });
      }
    }, 2000);
  }

  async function copyCommand() {
    if (auth.phase !== "waiting") return;
    await navigator.clipboard.writeText(auth.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function connectManual() {
    if (!manualToken.trim()) return;
    setManualConnecting(true);
    setManualError("");
    try {
      const res = await fetch("/api/garmin/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: manualToken.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Connection failed");
      }
      setManualToken("");
      setShowManual(false);
      await load();
    } catch (e) {
      setManualError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setManualConnecting(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect Garmin? Your imported activities will remain.")) return;
    await fetch("/api/garmin/connect", { method: "DELETE" });
    setStatus({ connected: false, connectedAt: null, lastSyncedAt: null });
    setAuth({ phase: "idle" });
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
            {auth.phase === "idle" && (
              <>
                <p className="text-xs text-muted">
                  Garmin blocks direct logins from cloud servers. The app will give you a command to run once on your computer — it authenticates from your home IP and sends the token here automatically.
                </p>
                <button onClick={startAuth} className="btn-primary">
                  <Link2 size={16} /> Connect Garmin
                </button>
                <button
                  onClick={() => setShowManual((v) => !v)}
                  className="text-xs text-muted underline text-center"
                >
                  {showManual ? "Hide manual token input" : "Already have a token? Paste it manually"}
                </button>
                {showManual && (
                  <>
                    <label>
                      <span className="label">Garmin token JSON</span>
                      <textarea
                        className="input mt-1 font-mono text-xs"
                        rows={4}
                        placeholder={'{"oauth1":{...},"oauth2":{...}}'}
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                      />
                    </label>
                    {manualError && <p className="rounded bg-danger/10 px-3 py-2 text-xs text-danger">{manualError}</p>}
                    <button onClick={connectManual} disabled={manualConnecting || !manualToken.trim()} className="btn-primary">
                      {manualConnecting ? "Connecting…" : "Connect with token"}
                    </button>
                  </>
                )}
              </>
            )}

            {auth.phase === "waiting" && (
              <>
                <div className="flex items-center gap-3">
                  <RefreshCw size={18} className="animate-spin text-accent shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Getting Garmin token…</p>
                    <p className="text-xs text-muted">Waiting for your computer to authenticate</p>
                  </div>
                </div>

                <div className="rounded border border-border bg-surface-2 p-3 space-y-2">
                  <p className="text-xs text-muted font-medium">Run this in your terminal:</p>
                  <div className="flex items-start gap-2">
                    <code className="text-[11px] font-mono break-all flex-1 text-text leading-relaxed">
                      {auth.command}
                    </code>
                    <button
                      onClick={copyCommand}
                      className="shrink-0 text-muted hover:text-accent transition mt-0.5"
                      aria-label="Copy command"
                    >
                      {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted">
                    The command includes a one-time session ID. Once the script runs, this page will connect automatically.
                  </p>
                </div>

                <button
                  onClick={() => { if (pollRef.current) clearInterval(pollRef.current); setAuth({ phase: "idle" }); }}
                  className="btn-ghost w-full"
                >
                  Cancel
                </button>
              </>
            )}

            {auth.phase === "done" && (
              <p className="text-sm text-accent text-center font-medium">Connected successfully!</p>
            )}

            {auth.phase === "expired" && (
              <>
                <p className="rounded bg-danger/10 px-3 py-2 text-xs text-danger">
                  Session expired (10 min limit). Start again.
                </p>
                <button onClick={startAuth} className="btn-primary">
                  <Link2 size={16} /> Try again
                </button>
              </>
            )}

            {auth.phase === "error" && (
              <>
                <p className="rounded bg-danger/10 px-3 py-2 text-xs text-danger">{auth.message}</p>
                <button onClick={() => setAuth({ phase: "idle" })} className="btn-ghost w-full">Dismiss</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
