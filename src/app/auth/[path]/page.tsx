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
  const [busy, setBusy] = useState<"email" | "google" | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy("email");
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
        setBusy(null);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Authentication failed.");
      setBusy(null);
    }
  }

  async function continueWithGoogle() {
    setBusy("google");
    setError("");
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
      if (result.error) {
        setError(result.error.message || "Google sign-in failed.");
        setBusy(null);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Google sign-in failed.");
      setBusy(null);
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
            <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.24em] text-accent">Your training archive</p>
            <p className="font-display text-6xl leading-none tracking-[0.05em]">Fitlog</p>
            <h1 className="mt-3 font-display text-2xl tracking-[0.04em]">{signingUp ? "Create your account" : "Welcome back"}</h1>
            <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-muted">
              {signingUp
                ? "Start a private training, nutrition and progress log."
                : "Sign in to your health and training data."}
            </p>
          </div>
        </div>

        <div className="card flex flex-col gap-4 p-5">
          <button
            type="button"
            onClick={continueWithGoogle}
            className="btn-ghost w-full bg-text text-bg"
            disabled={busy !== null}
          >
            <GoogleMark />
            {busy === "google" ? "Opening Google…" : "Continue with Google"}
          </button>

          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            <span className="font-display text-xs uppercase tracking-[0.16em] text-muted">or use email</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
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
          <button className="btn-primary mt-1" disabled={busy !== null}>
            {signingUp ? <UserPlus size={18} /> : <LogIn size={18} />}
            {busy === "email" ? "Please wait…" : signingUp ? "Create account" : "Sign in"}
          </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-muted">
          {signingUp ? "Already have an account?" : "New to Fitlog?"}{" "}
          <Link className="font-medium text-accent" href={signingUp ? "/auth/sign-in" : "/auth/sign-up"}>
            {signingUp ? "Sign in" : "Create account"}
          </Link>
        </p>
        {signingUp && (
          <p className="mx-auto mt-4 max-w-xs text-center text-[11px] leading-relaxed text-muted">
            By creating an account, you agree to the <Link href="/terms" className="text-text underline underline-offset-2">Terms</Link> and acknowledge the <Link href="/privacy" className="text-text underline underline-offset-2">Privacy Policy</Link>.
          </p>
        )}
        {!signingUp && (
          <p className="mt-4 text-center text-[11px] text-muted">
            <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>
            <span aria-hidden="true"> · </span>
            <Link href="/terms" className="underline underline-offset-2">Terms</Link>
          </p>
        )}
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" role="img">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.42l-3.24-2.53c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.77-5.62-4.14H3.03v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.38 13.87A6.02 6.02 0 0 1 6.07 12c0-.65.11-1.28.31-1.87v-2.6H3.03A10 10 0 0 0 2 12c0 1.61.38 3.14 1.03 4.47l3.35-2.6Z" />
      <path fill="#EA4335" d="M12 5.99c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.97 5.53l3.35 2.6C7.18 7.76 9.39 6 12 6Z" />
    </svg>
  );
}
