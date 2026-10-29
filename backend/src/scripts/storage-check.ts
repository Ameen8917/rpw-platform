/* npm run storage:check — confirms the backend can use Supabase Storage:
   the bucket exists and is private, and a test image can be uploaded, read through a signed
   URL and deleted again (it leaves nothing behind). Never prints the service role key. */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { EnvError, loadEnv } from "../config/env.js";
import { decodeSignature } from "../modules/files/files.service.js";
import { createSupabaseStorage } from "../modules/files/storage.js";

/* 1×1 transparent PNG */
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function main() {
  const env = loadEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new EnvError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set (backend/.env). See docs/supabase-setup.md, section 7.");
  }
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, SUPABASE_STORAGE_BUCKET: bucket } = env;
  console.log(`Checking Storage at ${url}, bucket "${bucket}" ...`);

  const res = await fetch(`${url}/storage/v1/bucket/${encodeURIComponent(bucket)}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) {
    const hint = res.status === 404 || res.status === 400 ? ` Create a private bucket named "${bucket}" (Storage → New bucket).`
      : res.status === 401 || res.status === 403 ? " Check SUPABASE_SERVICE_ROLE_KEY: it must be the secret / service_role key, not the anon key." : "";
    throw new Error(`Bucket lookup failed: ${res.status} ${(await res.text()).slice(0, 200)}.${hint}`);
  }
  const info = (await res.json()) as { public: boolean; file_size_limit: number | null; allowed_mime_types: string[] | null };
  if (info.public) throw new Error(`Bucket "${bucket}" is PUBLIC: anyone with a file path could read signatures. Make it private.`);
  console.log(`  bucket       exists, private`);

  const storage = createSupabaseStorage({ url, serviceKey: key, bucket });
  const path = `healthcheck/${randomUUID()}.png`;
  await storage.upload(path, decodeSignature(PNG), "image/png");
  try {
    const signed = (await storage.signedUrls([path], 60)).get(path);
    if (!signed) throw new Error("Upload worked but no signed URL was returned.");
    const read = await fetch(signed);
    if (!read.ok) throw new Error(`Signed URL did not serve the file: ${read.status}`);
    const anonymous = await fetch(`${url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path}`);
    console.log(`  upload       ok`);
    console.log(`  signed URL   ok`);
    console.log(`  public URL   ${anonymous.ok ? "READABLE — the bucket is not private!" : "refused (as it should be)"}`);
  } finally {
    await storage.remove([path]);
    console.log(`  test file    removed`);
  }
  console.log("Storage is ready.");
}

main().catch((err) => {
  console.error(err instanceof EnvError ? err.message : `Storage check failed: ${(err as Error).message}`);
  process.exitCode = 1;
});
