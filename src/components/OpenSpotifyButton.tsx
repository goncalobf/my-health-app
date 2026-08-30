"use client";

import { Music } from "lucide-react";

const SPOTIFY_APP_URI = "spotify:";
const SPOTIFY_FALLBACK_URL = "https://open.spotify.com";

/**
 * Deep-links into the user's own Spotify app to resume whatever they were
 * last playing. Fitlog has no Spotify account connection: this is just a
 * launcher, so it falls back to the web player if the app isn't installed
 * or the custom scheme is blocked.
 */
export default function OpenSpotifyButton() {
  function open() {
    const fallbackTimer = window.setTimeout(() => {
      if (!document.hidden) {
        window.open(SPOTIFY_FALLBACK_URL, "_blank", "noopener,noreferrer");
      }
    }, 1200);
    window.addEventListener(
      "visibilitychange",
      () => window.clearTimeout(fallbackTimer),
      { once: true }
    );
    window.location.href = SPOTIFY_APP_URI;
  }

  return (
    <button
      onClick={open}
      className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-surface text-muted transition active:scale-95 [border-radius:2px_9px_2px_2px]"
      aria-label="Open Spotify"
    >
      <Music size={18} />
    </button>
  );
}
