"use client";

import { useEffect, useState } from "react";
import { Link2, Link2Off, RefreshCw, Eye, EyeOff } from "lucide-react";
import { apiGet } from "@/lib/api";

interface ConnectionStatus {
  connected: boolean;
  connectedAt: string | null;
  lastSyncedAt: string | null;
}

export default function GarminSettings() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function load() {
    const s = await apiGet<ConnectionStatus>("/api/garmin/connect");
    setStatus(s);
  }

  useEffect(() => {
    load();
  }, []);

  async function connect() {
    if (!username.trim() || !password) return;
    setConnecting(true);
    setError("");
    try {
      await fetch("/api/garmin/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      }).then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? "Connection failed");
        }
      });
      setUsername("");
      setPassword("");
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

            <button onClick={sync} disabled={syncing} className="btn-ghost w-full">
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing…" : "Sync now"}
            </button>

            {syncResult && (
              <p className="text-xs text-accent text-center">{syncResult}</p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-muted">
              Connect your Garmin account to import completed activities. Strength training
              sessions are excluded — those should be logged manually for proper tracking.
            </p>

            <label>
              <span className="label">Garmin username / email</span>
              <input
                className="input mt-1"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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

            {error && (
              <p className="rounded bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
            )}

            <button
              onClick={connect}
              disabled={connecting || !username.trim() || !password}
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
