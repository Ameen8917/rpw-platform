import { HttpError } from "../../lib/http-error.js";

/* Where file bytes live. The database keeps only a reference (the files table). */
export interface FileStorage {
  upload(path: string, bytes: Buffer, contentType: string): Promise<void>;
  /** Short-lived URLs the browser can load, keyed by path; paths that cannot be signed are left out */
  signedUrls(paths: string[], expiresInSeconds: number): Promise<Map<string, string>>;
  remove(paths: string[]): Promise<void>;
}

export class StorageError extends Error {}

type Fetch = typeof fetch;

/* Supabase Storage over its REST API, with the service role key. The bucket is private: nothing
   is readable without a signed URL issued here. The key never leaves the backend. */
export function createSupabaseStorage(opts: { url: string; serviceKey: string; bucket: string; fetch?: Fetch }): FileStorage {
  const http = opts.fetch ?? fetch;
  const base = `${opts.url}/storage/v1`;
  const bucket = encodeURIComponent(opts.bucket);
  const objectPath = (path: string) => path.split("/").map(encodeURIComponent).join("/");
  const headers = (extra: Record<string, string> = {}) => ({
    apikey: opts.serviceKey, Authorization: `Bearer ${opts.serviceKey}`, ...extra,
  });

  async function call(what: string, url: string, init: RequestInit) {
    const res = await http(url, init);
    if (!res.ok) {
      /* Storage's message (e.g. "Bucket not found"), never the request headers */
      const body = await res.text().catch(() => "");
      throw new StorageError(`Storage ${what} failed: ${res.status} ${body.slice(0, 200)}`);
    }
    return res;
  }

  return {
    async upload(path, bytes, contentType) {
      await call("upload", `${base}/object/${bucket}/${objectPath(path)}`, {
        method: "POST",
        headers: headers({ "Content-Type": contentType, "x-upsert": "false", "Cache-Control": "max-age=3600" }),
        body: new Uint8Array(bytes),
      });
    },

    async signedUrls(paths, expiresInSeconds) {
      const out = new Map<string, string>();
      if (!paths.length) return out;
      const res = await call("signing", `${base}/object/sign/${bucket}`, {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ expiresIn: expiresInSeconds, paths }),
      });
      const rows = (await res.json()) as { path: string | null; signedURL: string | null; error: string | null }[];
      for (const r of rows) if (r.path && r.signedURL && !r.error) out.set(r.path, base + r.signedURL);
      return out;
    },

    async remove(paths) {
      if (!paths.length) return;
      await call("delete", `${base}/object/${bucket}`, {
        method: "DELETE",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ prefixes: paths }),
      });
    },
  };
}

/* Used when Supabase Storage is not configured (development): reading works with no URLs,
   saving a file is refused with 503 so the rest of the app keeps running. */
export function createUnconfiguredStorage(): FileStorage {
  return {
    async upload() {
      throw new HttpError(503, "storage_unavailable", "File storage is not configured on this server (SUPABASE_URL)");
    },
    async signedUrls() { return new Map(); },
    async remove() {},
  };
}

/* In-process storage for tests */
export function createMemoryStorage() {
  const objects = new Map<string, { bytes: Buffer; contentType: string }>();
  const storage: FileStorage = {
    async upload(path, bytes, contentType) {
      if (objects.has(path)) throw new StorageError("Storage upload failed: 409 already exists");
      objects.set(path, { bytes, contentType });
    },
    async signedUrls(paths) {
      return new Map(paths.filter((p) => objects.has(p)).map((p) => [p, `memory://signed/${p}`]));
    },
    async remove(paths) { for (const p of paths) objects.delete(p); },
  };
  return { ...storage, objects };
}
