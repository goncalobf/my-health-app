"use client";

import { ShieldX } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AccessPendingPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function claimOwner(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/claim-owner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (response.ok) {
      router.replace("/");
      router.refresh();
      return;
    }
    const payload = await response.json().catch(() => ({}));
    setError(payload.error || "Could not claim the owner account.");
    setBusy(false);
  }

  async function signOut() {
    await authClient.signOut();
    router.replace("/auth/sign-in");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 safe-bottom safe-top">
      <div className="card w-full max-w-sm p-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warn/15 text-warn">
          <ShieldX size={26} />
        </div>
        <h1 className="mt-4 text-xl font-bold">Access unavailable</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This account cannot access Fitlog. It may have been disabled by the service owner. If you believe this is a mistake, sign out and contact support.
        </p>
        <details className="mt-5 text-left">
          <summary className="cursor-pointer text-center text-sm font-medium text-accent">I am the existing Fitlog owner</summary>
          <form onSubmit={claimOwner} className="mt-3 flex flex-col gap-2">
            <p className="text-xs text-muted">Enter the previous shared Fitlog password once to attach the existing records to your Neon account.</p>
            <input type="password" autoComplete="current-password" className="input" placeholder="Previous Fitlog password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            {error && <p className="text-xs text-danger">{error}</p>}
            <button className="btn-primary" disabled={busy}>{busy ? "Claiming…" : "Claim existing data"}</button>
          </form>
        </details>
        <button onClick={signOut} className="btn-ghost mt-5 w-full">Sign out</button>
      </div>
    </main>
  );
}
