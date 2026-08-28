"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export default function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result) => {
            if (result && !cancelled) {
              cancelled = true;
              navigator.vibrate?.(80);
              controls.stop();
              onDetected(result.getText());
            }
          }
        );
        stop = () => controls.stop();
      } catch {
        setError(
          "Couldn't access the camera. You can type the barcode number instead."
        );
      }
    })();

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 safe-top">
        <span className="text-white font-semibold">Scan barcode</span>
        <button onClick={onClose} className="text-white p-1" aria-label="Close">
          <X size={24} />
        </button>
      </div>

      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        {!error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-40 border-2 border-accent rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
          </div>
        )}
        {error && (
          <p className="absolute bottom-4 inset-x-4 text-center text-white/80 text-sm">
            {error}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) onDetected(manual.trim());
        }}
        className="p-4 safe-bottom flex gap-2 bg-surface"
      >
        <input
          className="input flex-1"
          inputMode="numeric"
          placeholder="Or enter barcode number"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
        <button className="btn-primary" disabled={!manual.trim()}>
          Look up
        </button>
      </form>
    </div>
  );
}
