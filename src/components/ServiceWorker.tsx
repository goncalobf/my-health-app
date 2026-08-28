"use client";

import { useEffect } from "react";

export default function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Fitlog is intentionally always-online. Remove the old offline worker,
      // which could otherwise serve stale authenticated pages after logout.
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister()))
        )
        .catch(() => {});
    }
    if ("caches" in window) {
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith("fitlog-"))
              .map((key) => caches.delete(key))
          )
        )
        .catch(() => {});
    }
  }, []);
  return null;
}
