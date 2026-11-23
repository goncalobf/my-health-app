"use client";

import Image from "next/image";
import { Dumbbell, Maximize2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { exerciseDemo, type ExerciseDemo } from "@/lib/exercise-demo";
import { cn } from "@/lib/utils";

function DemoFrame({ name, src, position }: { name: string; src: string; position?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="min-w-0 space-y-1.5">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-surface-2">
        {failed ? (
          <p className="grid h-full place-items-center p-2 text-center text-xs text-muted">Image unavailable</p>
        ) : (
          <Image
            src={src}
            alt={position ? `${name}, position ${position}` : `${name} demonstration`}
            fill
            sizes={position ? "(max-width: 640px) 45vw, 304px" : "(max-width: 640px) 90vw, 608px"}
            unoptimized={src.startsWith("/exercise-demos/")}
            className="object-contain"
            onError={() => setFailed(true)}
          />
        )}
      </div>
      {position && <figcaption className="text-center text-xs font-semibold text-muted">Position {position}</figcaption>}
    </figure>
  );
}

function Lightbox({ name, demo, onClose }: { name: string; demo: ExerciseDemo; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current!;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-[42rem] overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-text backdrop:bg-black/80"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="space-y-4 p-4 sm:p-5">
        <header className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="min-w-0 break-words font-display text-xl">{name}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close exercise demo">
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className={cn("grid gap-2", demo.frames.length > 1 && "grid-cols-2")}>
          {demo.frames.map((src, i) => (
            <DemoFrame key={src} name={name} src={src} position={demo.frames.length > 1 ? i + 1 : undefined} />
          ))}
        </div>
        {demo.note && <p className="text-sm leading-relaxed text-muted">{demo.note}</p>}
        {(demo.source || demo.equipmentLink) && (
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
            {demo.source && (
              <a href={demo.source.href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {demo.source.name}
              </a>
            )}
            {demo.equipmentLink && (
              <a href={demo.equipmentLink} target="_blank" rel="noreferrer" className="font-semibold text-accent underline underline-offset-2">
                Manufacturer’s equipment guide
              </a>
            )}
          </div>
        )}
      </div>
    </dialog>,
    document.body,
  );
}

export default function ExerciseImage({
  name,
  imageUrl,
  className,
  expandable,
  variant = "photo",
}: {
  name: string;
  imageUrl: string | null;
  className?: string;
  expandable?: boolean;
  variant?: "photo" | "illustration";
}) {
  const illustration = variant === "illustration";
  const demo = illustration ? null : exerciseDemo(name, imageUrl) ?? (imageUrl ? { frames: [imageUrl] } : null);
  const src = demo?.frames[0] ?? imageUrl;
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const canExpand = expandable && demo;
  const Frame = canExpand ? "button" : "div";

  return (
    <>
      <Frame
        type={canExpand ? "button" : undefined}
        aria-label={canExpand ? `View exercise demo for ${name}` : undefined}
        aria-haspopup={canExpand ? "dialog" : undefined}
        className={cn(
          "relative shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2",
          canExpand && "cursor-zoom-in active:opacity-80",
          className,
        )}
        onClick={canExpand ? (event) => {
          event.currentTarget.focus({ preventScroll: true });
          setOpen(true);
        } : undefined}
      >
        {src && src !== failedImage ? (
          <Image
            src={src}
            alt={canExpand ? "" : `${name} ${illustration ? "movement illustration" : "demonstration"}`}
            fill
            sizes={illustration ? undefined : "80px"}
            unoptimized={illustration || src.startsWith("/exercise-demos/")}
            className={illustration ? "object-contain" : "object-cover"}
            onError={() => setFailedImage(src)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            {illustration ? <p className="p-2 text-center text-sm">Illustration unavailable</p> : <Dumbbell size={20} aria-hidden="true" />}
          </div>
        )}
        {canExpand && (
          <span className="absolute bottom-0.5 right-0.5 rounded-md bg-black/80 p-1 text-white" aria-hidden="true">
            <Maximize2 size={12} />
          </span>
        )}
      </Frame>
      {open && demo && <Lightbox name={name} demo={demo} onClose={() => setOpen(false)} />}
    </>
  );
}
