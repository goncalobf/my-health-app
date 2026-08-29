import Image from "next/image";
import { imagePath, type MotivationImage } from "@/lib/motivation";

type Variant = "hero" | "full" | "panel";

// `flex` on the frame lets the content stretch and sit against the bottom;
// a plain `h-full` child cannot resolve against a min-height-only parent.
const FRAME: Record<Variant, string> = {
  hero: "relative isolate flex min-h-[18rem] overflow-hidden border border-border [border-radius:2px_24px_2px_2px]",
  full: "relative isolate flex overflow-hidden",
  panel: "relative isolate flex min-h-48 overflow-hidden border border-border [border-radius:2px_20px_2px_2px]",
};

const HEADLINE: Record<Variant, string> = {
  hero: "text-[2.8rem] min-[360px]:text-[3.35rem]",
  full: "text-6xl min-[360px]:text-7xl",
  panel: "text-3xl min-[360px]:text-4xl",
};

/**
 * A poster: dark photography, stripped of colour, with a hard line over it.
 * Presentational only so server components can render it directly.
 */
export default function MotivationCard({
  image,
  line,
  fact,
  eyebrow,
  variant = "hero",
  priority = false,
  className = "",
  children,
}: {
  image: MotivationImage;
  line: string;
  fact?: string | null;
  eyebrow?: string | null;
  variant?: Variant;
  priority?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={`${FRAME[variant]} ${className}`.trim()}>
      <Image
        src={imagePath(image)}
        alt=""
        aria-hidden
        fill
        priority={priority}
        sizes="(max-width: 512px) 100vw, 512px"
        className="-z-10 object-cover grayscale brightness-[0.5] contrast-[1.35]"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-bg via-bg/35 to-transparent" />
      <div className="pointer-events-none absolute inset-0 border-[10px] border-bg/15 mix-blend-multiply" />
      <div className="absolute left-4 top-4 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.22em] text-text/75">
        <span className="h-px w-5 bg-accent" /> Fitlog / daily protocol
      </div>
      <span className="absolute right-4 top-4 font-display text-2xl text-text/20">01</span>

      <div
        className={`flex min-w-0 flex-1 flex-col justify-end gap-2 p-5 ${
          variant === "full" ? "min-[360px]:p-7" : "min-[360px]:p-6"
        }`}
      >
        {eyebrow && (
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-accent">
            {eyebrow}
          </p>
        )}
        <p
          className={`min-w-0 text-balance font-display uppercase leading-[0.86] tracking-[0.015em] text-text drop-shadow-lg ${HEADLINE[variant]}`}
        >
          {line}
        </p>
        {fact && (
          <p className="max-w-[34rem] border-l border-accent pl-3 text-xs font-medium leading-relaxed text-text/75 min-[360px]:text-sm">
            {fact}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
