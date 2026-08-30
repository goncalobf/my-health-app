"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { loadBarcodeReader } from "@/lib/barcode-scanner-loader";

export default function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const detectedRef = useRef(false);
  const stopRef = useRef<(() => void) | undefined>(undefined);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  const beginLookup = useCallback(async (code: string, stop?: () => void) => {
    const normalizedCode = code.trim();
    if (!normalizedCode || detectedRef.current) return;
    detectedRef.current = true;
    setLookingUp(true);
    (stop ?? stopRef.current)?.();
    navigator.vibrate?.(80);
    await onDetectedRef.current(normalizedCode);
  }, []);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const {
          createFoodBarcodeReader,
          FOOD_BARCODE_CAMERA_CONSTRAINTS,
        } = await loadBarcodeReader();
        if (cancelled || !videoRef.current) return;

        const reader = createFoodBarcodeReader();
        const controls = await reader.decodeFromConstraints(
          FOOD_BARCODE_CAMERA_CONSTRAINTS,
          videoRef.current!,
          (result, _scanError, scanControls) => {
            if (result && !cancelled && !detectedRef.current) {
              void beginLookup(result.getText(), scanControls.stop);
            }
          }
        );
        if (cancelled) controls.stop();
        else {
          stop = controls.stop;
          stopRef.current = controls.stop;
        }
      } catch {
        if (!cancelled) {
          setError(
            "Couldn't access the camera. You can type the barcode number instead."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      stop?.();
      stopRef.current = undefined;
    };
  }, [beginLookup]);

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
          onPlaying={() => setCameraReady(true)}
        />
        {!error && !lookingUp && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="h-40 w-[min(16rem,calc(100vw-2rem))] rounded-2xl border-2 border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
            <p className="absolute bottom-6 inset-x-4 text-center text-sm font-medium text-white">
              {cameraReady ? "Hold the barcode inside the frame" : "Starting camera…"}
            </p>
          </div>
        )}
        {lookingUp && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/65 text-white">
            <LoaderCircle size={30} className="animate-spin text-accent" />
            <p className="text-sm font-medium">Barcode found · Loading product…</p>
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
          if (manual.trim()) void beginLookup(manual);
        }}
        className="p-4 safe-bottom flex gap-2 bg-surface"
      >
        <input
          className="input min-w-0 flex-1"
          inputMode="numeric"
          placeholder="Or enter barcode number"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
        <button
          className="btn-primary shrink-0"
          disabled={!manual.trim() || lookingUp}
        >
          {lookingUp ? "Loading…" : "Look up"}
        </button>
      </form>
    </div>
  );
}
