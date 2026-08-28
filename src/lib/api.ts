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
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || `Request failed (${res.status})`);
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
