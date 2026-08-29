"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dumbbell, LogIn, UserPlus } from "lucide-react";
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
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 safe-bottom safe-top">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Dumbbell size={29} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{signingUp ? "Create your Fitlog" : "Welcome to Fitlog"}</h1>
            <p className="mt-1 text-sm text-muted">
              {signingUp
                ? "Use the exact email address that was invited."
                : "Sign in to your private health and training data."}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="card flex flex-col gap-3 p-4">
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
