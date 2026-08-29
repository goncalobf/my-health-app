"use client";

import { use, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogIn, UserPlus } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = use(params);
  const router = useRouter();
  const signingUp = path === "sign-up";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const result = signingUp
        ? await authClient.signUp.email({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
          })
        : await authClient.signIn.email({
            email: email.trim().toLowerCase(),
            password,
          });

      if (result.error) {
        setError(result.error.message || "Authentication failed.");
        setBusy(false);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Authentication failed.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 safe-bottom safe-top">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="h-20 w-20 overflow-hidden border border-border bg-black [border-radius:2px_16px_2px_2px]">
            <Image src="/icons/icon-192.png" alt="Fitlog" width={80} height={80} priority />
          </div>
          <div>
            <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.24em] text-accent">Training archive / private</p>
            <p className="font-display text-6xl leading-none tracking-[0.05em]">Fitlog</p>
            <h1 className="mt-3 font-display text-2xl tracking-[0.04em]">{signingUp ? "Create your account" : "Welcome back"}</h1>
            <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-muted">
              {signingUp
                ? "Use the exact email address that was invited."
                : "Sign in to your private health and training data."}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="card flex flex-col gap-4 p-5">
          {signingUp && (
            <label>
              <span className="label">Name</span>
              <input className="input mt-1" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
          )}
          <label>
            <span className="label">Email</span>
            <input className="input mt-1" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            <span className="label">Password</span>
            <input className="input mt-1" type="password" autoComplete={signingUp ? "new-password" : "current-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <button className="btn-primary mt-1" disabled={busy}>
            {signingUp ? <UserPlus size={18} /> : <LogIn size={18} />}
            {busy ? "Please wait…" : signingUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          {signingUp ? "Already have an account?" : "Invited to Fitlog?"}{" "}
          <Link className="font-medium text-accent" href={signingUp ? "/auth/sign-in" : "/auth/sign-up"}>
            {signingUp ? "Sign in" : "Create account"}
          </Link>
        </p>
      </div>
    </main>
  );
}
