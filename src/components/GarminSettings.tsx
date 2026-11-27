"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Link2Off,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";

interface ConnectionStatus {
  connected: boolean;
  connectedAt: string | null;
  lastSyncedAt: string | null;
}

interface Handshake {
  id: string;
  secret: string;
}

type AuthPhase = "idle" | "mfa" | "error";
type AuthResult = { status: "connected" } | {
  status: "mfa_required";
  state: string;
  error?: string;
};

const AUTH_TIMEOUT_MS = 65_000;

class GarminSignInError extends Error {
  constructor(message: string, readonly canRetryVerification: boolean) {
    super(message);
  }
}

function authErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Garmin sign-in took too long. Please try again.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Could not connect to Garmin. Please try again.";
}

async function authRequest(body: Record<string, string>): Promise<AuthResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);
  try {
    const response = await fetch("/api/garmin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({})) as {
      status?: string;
      state?: string;
      error?: string;
    };
    if (!response.ok) {
      throw new GarminSignInError(
        result.error ?? "Garmin sign-in failed. Please try again.",
        response.status === 429 || response.status === 503,
      );
    }
    if (result.status === "mfa_required" && typeof result.state === "string") {
      return {
        status: "mfa_required",
        state: result.state,
        error: typeof result.error === "string" ? result.error : undefined,
      };
    }
    if (result.status === "connected") return { status: "connected" };
    throw new Error("Garmin returned an invalid sign-in response.");
  } finally {
    window.clearTimeout(timeout);
  }
}

export default function GarminSettings() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [phase, setPhase] = useState<AuthPhase>("idle");
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [handshake, setHandshake] = useState<Handshake | null>(null);
  const [mfaState, setMfaState] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncError, setSyncError] = useState("");
  const [statusError, setStatusError] = useState(false);
  const statusRequest = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++statusRequest.current;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const nextStatus = await api<ConnectionStatus>("/api/garmin/connect", { signal: controller.signal });
      if (requestId !== statusRequest.current) return;
      setStatus(nextStatus);
      setStatusError(false);
    } catch {
      if (requestId === statusRequest.current) setStatusError(true);
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function clearVerification() {
    setMfaCode("");
    setMfaState("");
    setHandshake(null);
  }

  async function finishConnection() {
    setStatus({ connected: true, connectedAt: null, lastSyncedAt: null });
    setPhase("idle");
    setUsername("");
    setPassword("");
    clearVerification();
    await load();
  }

  async function connect() {
    if (!username.trim() || !password || busy) return;
    setBusy(true);
    setAuthError("");
    try {
      const sessionResponse = await fetch("/api/garmin/auth-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "browser" }),
      });
      if (!sessionResponse.ok) {
        const result = await sessionResponse.json().catch(() => ({}));
        throw new Error(result.error ?? "Could not start the Garmin sign-in.");
      }
      const session = await sessionResponse.json() as Handshake;
      setHandshake(session);
      const result = await authRequest({
        action: "start",
        sessionId: session.id,
        secret: session.secret,
        username: username.trim(),
        password,
      });
      setPassword("");
      if (result.status === "mfa_required") {
        setMfaState(result.state);
        setPhase("mfa");
        return;
      }
      await finishConnection();
    } catch (error: unknown) {
      setPhase("error");
      setAuthError(authErrorMessage(error));
      setPassword("");
      clearVerification();
    } finally {
      setBusy(false);
    }
  }

  async function verifyMfa() {
    if (!handshake || !mfaState || !/^\d{4,10}$/.test(mfaCode.trim()) || busy) return;
    setBusy(true);
    setAuthError("");
    try {
      const result = await authRequest({
        action: "resume",
        sessionId: handshake.id,
        secret: handshake.secret,
        state: mfaState,
        mfaCode: mfaCode.trim(),
      });
      if (result.status === "mfa_required") {
        setMfaState(result.state);
        setAuthError(result.error ?? "That verification code was not accepted. Try a new code.");
        setMfaCode("");
        return;
      }
      await finishConnection();
    } catch (error: unknown) {
      setAuthError(authErrorMessage(error));
      setMfaCode("");
      if (!(error instanceof GarminSignInError && error.canRetryVerification)) {
        clearVerification();
        setPhase("error");
        // A transport failure can happen after the server saves the connection.
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function cancelMfa() {
    if (!handshake || busy) return;
    setBusy(true);
    setAuthError("");
    try {
      const response = await fetch(`/api/garmin/auth-session/${handshake.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      clearVerification();
      setPhase("idle");
      await load();
    } catch {
      setAuthError("Could not cancel the Garmin sign-in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (busy || syncing || !confirm("Disconnect Garmin? Your imported activities will remain.")) return;
    setBusy(true);
    setSyncError("");
    try {
      const response = await fetch("/api/garmin/connect", { method: "DELETE" });
      if (!response.ok) throw new Error();
      statusRequest.current++;
      setStatus({ connected: false, connectedAt: null, lastSyncedAt: null });
      setSyncResult(null);
      setPhase("idle");
      setStatusError(false);
    } catch {
      setSyncError("Could not disconnect Garmin. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    setSyncing(true);
    setSyncResult(null);
    setSyncError("");
    try {
      const response = await fetch("/api/garmin/sync", { method: "POST" });
      const body = await response.json().catch(() => ({})) as { imported?: number; error?: string };
      if (!response.ok) {
        setSyncError(body.error ?? "Sync failed");
        return;
      }
      const count = body.imported ?? 0;
      setSyncResult(count === 0 ? "No new Garmin activities." : `${count} new ${count === 1 ? "activity" : "activities"} ready to review.`);
      await load();
    } catch {
      setSyncError("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (!status && !statusError) return null;

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-muted mb-2">Garmin Connect</h2>
      <div className="card p-4 flex flex-col gap-4">
        {statusError && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted" role="status">
            <span>Could not refresh Garmin connection details.</span>
            <button type="button" onClick={load} disabled={busy || syncing} className="underline">Retry</button>
          </div>
        )}
        {!status ? null : status.connected ? (
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
              <button onClick={disconnect} disabled={busy || syncing} className="btn-danger px-3 py-2 text-sm shrink-0">
                <Link2Off size={14} /> Disconnect
              </button>
            </div>

            <div className="flex items-start gap-2 rounded border border-border bg-surface-2 px-3 py-2.5">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-xs text-muted leading-relaxed">
                Your session token is encrypted with AES-256-GCM. Fitlog uses it only for read-only imports and never changes data in Garmin.
              </p>
            </div>

            <button onClick={sync} disabled={busy || syncing} className="btn-ghost w-full">
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing…" : "Sync now"}
            </button>
            <Link href="/progress?view=garmin" className="btn-ghost w-full">View Garmin health</Link>
            {syncResult && <p className="text-xs text-accent text-center">{syncResult}</p>}
            {syncError && <p role="alert" className="rounded bg-danger/10 px-3 py-2 text-xs text-danger">{syncError}</p>}
          </>
        ) : phase === "mfa" ? (
          <>
            <div className="flex items-start gap-3">
              <KeyRound size={18} className="mt-0.5 shrink-0 text-accent" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Enter your Garmin verification code</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Garmin sent a code by email, SMS, or your authenticator app.
                </p>
              </div>
            </div>

            <label>
              <span className="label">Verification code</span>
              <input
                className="input mt-1 text-center text-lg tracking-[0.25em]"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={10}
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") verifyMfa();
                }}
                disabled={busy}
              />
            </label>

            {authError && (
              <p role="alert" className="rounded bg-danger/10 px-3 py-2 text-xs text-danger">{authError}</p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={cancelMfa} disabled={busy} className="btn-ghost">
                Start over
              </button>
              <button
                type="button"
                onClick={verifyMfa}
                disabled={!/^\d{4,10}$/.test(mfaCode.trim()) || busy}
                className="btn-primary"
              >
                {busy ? <RefreshCw size={16} className="animate-spin" /> : <KeyRound size={16} />}
                {busy ? "Checking…" : "Verify"}
              </button>
            </div>
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
                onChange={(event) => setUsername(event.target.value)}
                disabled={busy}
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
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") connect();
                  }}
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((value) => !value)}
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
                Your credentials are used once over HTTPS and never stored. Only the resulting session is saved, encrypted with AES-256-GCM, and Fitlog uses it only for read-only imports.
              </p>
            </div>

            {authError && (
              <p role="alert" className="rounded bg-danger/10 px-3 py-2 text-xs text-danger">{authError}</p>
            )}

            <button
              onClick={connect}
              disabled={!username.trim() || !password || busy}
              className="btn-primary"
            >
              {busy ? <RefreshCw size={16} className="animate-spin" /> : <Link2 size={16} />}
              {busy ? "Signing in…" : phase === "error" ? "Try again" : "Connect Garmin"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
