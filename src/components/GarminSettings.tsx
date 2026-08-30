"use client";

import { useEffect, useState } from "react";
import { Link2, Link2Off, RefreshCw, ShieldCheck, Terminal } from "lucide-react";
import { apiGet } from "@/lib/api";

interface ConnectionStatus {
  connected: boolean;
  connectedAt: string | null;
  lastSyncedAt: string | null;
}

export default function GarminSettings() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [token, setToken] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function load() {
    const s = await apiGet<ConnectionStatus>("/api/garmin/connect");
    setStatus(s);
  }

  useEffect(() => { load(); }, []);

  async function connect() {
    if (!token.trim()) return;
    setConnecting(true);
    setError("");
    try {
      const res = await fetch("/api/garmin/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Connection failed");
      }
      setToken("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect Garmin? Your imported activities will remain.")) return;
    await fetch("/api/garmin/connect", { method: "DELETE" });
    setStatus({ connected: false, connectedAt: null, lastSyncedAt: null });
  }

  async function sync() {
    setSyncing(true);
    setSyncResult(null);
    setError("");
    try {
      const res = await fetch("/api/garmin/sync", { method: "POST" });
      const body = await res.json().catch(() => ({})) as { imported?: number; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Sync failed");
        return;
      }
      setSyncResult(`${body.imported ?? 0} new activities imported`);
      await load();
    } catch {
      setError("Sync failed");
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
                Your token is encrypted with AES-256-GCM and stored only in your private database. It gives read-only API access — it cannot change your Garmin password or account settings.
              </p>
            </div>

            <button onClick={sync} disabled={syncing} className="btn-ghost w-full">
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing…" : "Sync now"}
            </button>

            {syncResult && <p className="text-xs text-accent text-center">{syncResult}</p>}
            {error && <p className="rounded bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
          </>
        ) : (
          <>
            <p className="text-xs text-muted">
              Garmin blocks direct logins from cloud servers. To connect, run a one-time script on your own computer to get a session token, then paste it here.
            </p>

            <div className="flex items-start gap-2 rounded border border-border bg-surface-2 px-3 py-2.5">
              <Terminal size={14} className="mt-0.5 shrink-0 text-accent" />
              <div className="text-xs text-muted leading-relaxed space-y-1">
                <p className="font-medium text-text">Run this once on your computer:</p>
                <code className="block bg-black/30 rounded px-2 py-1 font-mono text-[11px] break-all">
                  node scripts/garmin-auth.mjs
                </code>
                <p>Then copy the JSON output and paste it below.</p>
              </div>
            </div>

            <label>
              <span className="label">Garmin token</span>
              <textarea
                className="input mt-1 font-mono text-xs"
                rows={4}
                placeholder={'{"oauth1":{...},"oauth2":{...}}'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </label>

            <div className="flex items-start gap-2 rounded border border-border bg-surface-2 px-3 py-2.5">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-xs text-muted leading-relaxed">
                Tokens are encrypted with AES-256-GCM before storage. A token gives read-only API access — it cannot change your Garmin password or account settings, and can be revoked by changing your Garmin password.
              </p>
            </div>

            {error && <p className="rounded bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

            <button
              onClick={connect}
              disabled={connecting || !token.trim()}
              className="btn-primary"
            >
              <Link2 size={16} />
              {connecting ? "Connecting…" : "Connect Garmin"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
