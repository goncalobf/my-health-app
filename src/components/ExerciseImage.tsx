"use client";

import Image from "next/image";
import { Dumbbell, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

function Lightbox({ name, imageUrl, onClose }: { name: string; imageUrl: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <button
        className="absolute right-4 top-4 rounded-full bg-surface-2/80 p-2 text-muted"
        onClick={onClose}
        aria-label="Close"
      >
        <X size={20} />
      </button>
      <div
        className="relative h-[80vw] max-h-[80vh] w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={imageUrl}
          alt={`${name} demonstration`}
          fill
          sizes="(max-width: 512px) 100vw, 512px"
          className="object-contain"
        />
      </div>
      <p className="absolute bottom-6 left-0 right-0 text-center text-sm text-muted">{name}</p>
    </div>,
    document.body
  );
}

export default function ExerciseImage({
  name,
  imageUrl,
  className,
  expandable,
}: {
  name: string;
  imageUrl: string | null;
  className?: string;
  expandable?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setFailed(false), [imageUrl]);

  const canExpand = expandable && imageUrl && !failed;

  return (
    <>
      <div
        className={cn(
          "relative shrink-0 overflow-hidden border border-border bg-surface-2 [border-radius:2px_12px_2px_2px] grayscale contrast-110",
          canExpand && "cursor-zoom-in active:opacity-80",
          className
        )}
        onClick={canExpand ? () => setOpen(true) : undefined}
      >
        {imageUrl && !failed ? (
          <Image
            src={imageUrl}
            alt={`${name} demonstration`}
            fill
            sizes="80px"
            className="object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            <Dumbbell size={20} />
          </div>
        )}
      </div>
      {open && canExpand && (
        <Lightbox name={name} imageUrl={imageUrl} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
