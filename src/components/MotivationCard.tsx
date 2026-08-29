import Image from "next/image";
import { imagePath, type MotivationImage } from "@/lib/motivation";

type Variant = "hero" | "full" | "panel";

// `flex` on the frame lets the content stretch and sit against the bottom;
// a plain `h-full` child cannot resolve against a min-height-only parent.
const FRAME: Record<Variant, string> = {
  hero: "relative isolate flex min-h-44 overflow-hidden rounded-2xl border border-border",
  full: "relative isolate flex overflow-hidden",
  panel: "relative isolate flex min-h-36 overflow-hidden rounded-2xl border border-border",
};

const HEADLINE: Record<Variant, string> = {
  hero: "text-2xl min-[360px]:text-3xl",
  full: "text-4xl min-[360px]:text-5xl",
  panel: "text-xl min-[360px]:text-2xl",
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
        className="-z-10 object-cover grayscale brightness-[0.6] contrast-[1.15]"
      />
      {/* Keeps the type readable no matter how bright the photograph is. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-bg via-bg/75 to-bg/20" />

      <div
        className={`flex min-w-0 flex-1 flex-col justify-end gap-2 p-4 ${
          variant === "full" ? "min-[360px]:p-6" : ""
        }`}
      >
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            {eyebrow}
          </p>
        )}
        <p
          className={`min-w-0 text-balance font-black uppercase leading-[0.95] tracking-tight text-text drop-shadow-lg ${HEADLINE[variant]}`}
        >
          {line}
        </p>
        {fact && (
          <p className="min-w-0 text-xs font-medium text-muted min-[360px]:text-sm">
            {fact}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
