export async function api<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (res.status === 401 && typeof window !== "undefined") {
    const next = `${window.location.pathname}${window.location.search}`;
    // A full navigation is intentional here because this shared fetch helper
    // cannot use React's router hook.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/unlock?next=${encodeURIComponent(next)}`);
    throw new Error("Your session expired. Unlock Fitlog again.");
  }
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(
      typeof msg.error === "string"
        ? msg.error
        : `Request failed (${res.status})`
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const apiGet = <T>(p: string) => api<T>(p);
export const apiPost = <T>(p: string, body: unknown) =>
  api<T>(p, { method: "POST", body: JSON.stringify(body) });
export const apiPatch = <T>(p: string, body: unknown) =>
  api<T>(p, { method: "PATCH", body: JSON.stringify(body) });
export const apiDelete = <T>(p: string) =>
  api<T>(p, { method: "DELETE" });
