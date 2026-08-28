"use client";

import Image from "next/image";
import { Dumbbell } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export default function ExerciseImage({
  name,
  imageUrl,
  className,
}: {
  name: string;
  imageUrl: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [imageUrl]);

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2",
        className
      )}
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
  );
}
