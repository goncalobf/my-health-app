import Image from "next/image";
import Link from "next/link";

export function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh px-4 py-7 safe-bottom safe-top min-[520px]:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <nav className="mb-10 flex items-center justify-between gap-4" aria-label="Legal pages">
          <Link href="/auth/sign-in" className="flex items-center gap-3" aria-label="Fitlog sign in">
            <span className="h-10 w-10 overflow-hidden border border-border bg-black [border-radius:2px_10px_2px_2px]">
              <Image src="/icons/icon-192.png" alt="" width={40} height={40} priority />
            </span>
            <span className="font-display text-2xl tracking-[0.08em]">Fitlog</span>
          </Link>
          <div className="flex items-center gap-4 text-xs text-muted">
            <Link href="/privacy" className="underline-offset-4 hover:underline">Privacy</Link>
            <Link href="/terms" className="underline-offset-4 hover:underline">Terms</Link>
          </div>
        </nav>

        <header className="border-b border-border pb-7">
          <p className="font-display text-sm uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
          <h1 className="mt-2 font-display text-5xl leading-none tracking-[0.04em] min-[520px]:text-7xl">{title}</h1>
          <p className="mt-3 text-xs text-muted">Effective and last updated: {updated}</p>
        </header>

        <article className="legal-copy py-7">{children}</article>

        <footer className="border-t border-border py-6 text-xs text-muted">
          <p>Fitlog · Personal training, nutrition and progress tracking.</p>
          <Link href="/auth/sign-in" className="mt-2 inline-block text-accent">Return to sign in</Link>
        </footer>
      </div>
    </main>
  );
}
