/* Thin client for the RPW API. Requests go to /api on the same origin (Vite proxies it to the
   Express server in development), so the session cookie travels without any CORS setup.
   Errors arrive as { error: { code, message, details? } } and are thrown as ApiError. */

export interface ApiErrorDetail {
  location: string;
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: ApiErrorDetail[] = [],
  ) {
    super(message);
  }
}

/* Called when a request outside /auth answers 401: the session has ended */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) { onUnauthorized = fn; }

/* A Blob body (an uploaded file) is sent as it is, with its own type; anything else as JSON */
async function request<T>(method: "GET" | "POST" | "PUT" | "PATCH", path: string, body?: unknown): Promise<T> {
  const file = typeof Blob !== "undefined" && body instanceof Blob ? body : null;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (file) headers["Content-Type"] = file.type || "application/octet-stream";
  else if (body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers,
      body: file ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
  } catch {
    throw new ApiError(0, "network_error", "Cannot reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (res.ok) return data as T;

  const e = data?.error;
  const err = new ApiError(res.status, e?.code ?? "http_error", e?.message ?? `The server answered ${res.status}.`, Array.isArray(e?.details) ? e.details : []);
  if (res.status === 401 && !path.startsWith("/auth/")) onUnauthorized?.();
  throw err;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown = {}) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  upload: <T>(path: string, file: Blob) => request<T>("POST", path, file),
};

/** One line for a toast or an inline error: the first field problem if there is one */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const d = err.details[0];
    return d ? `${d.message}${d.path ? ` (${d.path})` : ""}` : err.message;
  }
  return "Something went wrong. Please try again.";
}
