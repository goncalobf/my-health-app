"use client";

import { useEffect, useRef, useState } from "react";

export function useLiveTimer(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const accRef = useRef(0);

  useEffect(() => {
    if (running) {
      startRef.current = Date.now();
      const iv = setInterval(() => {
        setElapsed(accRef.current + Math.floor((Date.now() - startRef.current!) / 1000));
      }, 250);
      return () => clearInterval(iv);
    } else {
      if (startRef.current !== null) {
        accRef.current += Math.floor((Date.now() - startRef.current) / 1000);
        startRef.current = null;
      }
      setElapsed(accRef.current);
    }
  }, [running]);

  function reset() {
    accRef.current = 0;
    startRef.current = running ? Date.now() : null;
    setElapsed(0);
  }

  return { elapsed, reset };
}

export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
