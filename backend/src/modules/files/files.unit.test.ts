import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../../lib/http-error.js";
import { TINY_PNG } from "../../test/fixtures.js";
import { ATTACHMENT_MAX_BYTES, checkAttachment, createFilesService, decodeSignature, SIGNATURE_MAX_BYTES } from "./files.service.js";
import { createMemoryStorage, createSupabaseStorage, createUnconfiguredStorage, StorageError } from "./storage.js";


const fakeFetch = (respond: (url: string, init: RequestInit) => Response) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init! });
    return respond(String(url), init!);
  });
  return { fetch: fn as unknown as typeof fetch, calls };
};

describe("Supabase Storage client", () => {
  const opts = { url: "https://abc.supabase.co", serviceKey: "service-key", bucket: "rpw-files" };

  it("uploads to the private bucket without overwriting", async () => {
    const f = fakeFetch(() => new Response("{}", { status: 200 }));
    await createSupabaseStorage({ ...opts, fetch: f.fetch }).upload("signatures/2026/10/x.png", Buffer.from("png"), "image/png");
    const { url, init } = f.calls[0];
    expect(url).toBe("https://abc.supabase.co/storage/v1/object/rpw-files/signatures/2026/10/x.png");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ apikey: "service-key", Authorization: "Bearer service-key", "x-upsert": "false", "Content-Type": "image/png" });
  });

  it("signs many paths in one call and returns full URLs", async () => {
    const f = fakeFetch(() => Response.json([
      { path: "a.png", signedURL: "/object/sign/rpw-files/a.png?token=t1", error: null },
      { path: "gone.png", signedURL: null, error: "Either the object does not exist or you do not have access to it" },
    ]));
    const urls = await createSupabaseStorage({ ...opts, fetch: f.fetch }).signedUrls(["a.png", "gone.png"], 600);
    expect(f.calls[0].url).toBe("https://abc.supabase.co/storage/v1/object/sign/rpw-files");
    expect(JSON.parse(String(f.calls[0].init.body))).toEqual({ expiresIn: 600, paths: ["a.png", "gone.png"] });
    expect([...urls]).toEqual([["a.png", "https://abc.supabase.co/storage/v1/object/sign/rpw-files/a.png?token=t1"]]);
  });

  it("makes no call for nothing to sign or remove", async () => {
    const f = fakeFetch(() => new Response("{}"));
    const s = createSupabaseStorage({ ...opts, fetch: f.fetch });
    expect((await s.signedUrls([], 600)).size).toBe(0);
    await s.remove([]);
    expect(f.calls).toHaveLength(0);
  });

  it("reports Storage's error without the key", async () => {
    const f = fakeFetch(() => new Response('{"message":"Bucket not found"}', { status: 404 }));
    const err = await createSupabaseStorage({ ...opts, fetch: f.fetch }).upload("a.png", Buffer.from("x"), "image/png").catch((e) => e);
    expect(err).toBeInstanceOf(StorageError);
    expect(err.message).toMatch(/404.*Bucket not found/);
    expect(err.message).not.toContain("service-key");
  });

  it("answers 503 for uploads when Storage is not configured", async () => {
    const err = await createUnconfiguredStorage().upload("a.png", Buffer.from("x"), "image/png").catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(503);
  });
});

describe("signature images", () => {
  it("accepts a PNG data URL", () => {
    expect(decodeSignature(TINY_PNG).subarray(1, 4).toString()).toBe("PNG");
  });

  it("rejects other content, even when labelled PNG", () => {
    const bad = (s: string) => expect(() => decodeSignature(s)).toThrow(HttpError);
    bad("data:image/png;base64,AAAA");
    bad("data:image/jpeg;base64,/9j/4AAQ");
    bad(TINY_PNG + "!");
    const huge = Buffer.concat([Buffer.from(TINY_PNG.split(",")[1], "base64"), Buffer.alloc(SIGNATURE_MAX_BYTES)]);
    bad("data:image/png;base64," + huge.toString("base64"));
  });

  it("stores under a dated, unguessable path and records size and hash", async () => {
    const storage = createMemoryStorage();
    const files = createFilesService({ storage, bucket: "rpw-files", now: () => new Date("2026-10-29T10:00:00Z") });
    const up = await files.storeSignature(TINY_PNG);
    expect(up.path).toMatch(/^signatures\/2026\/10\/[0-9a-f-]{36}\.png$/);
    expect(up).toMatchObject({ bucket: "rpw-files", contentType: "image/png", purpose: "signature" });
    expect(up.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(storage.objects.get(up.path)?.bytes.length).toBe(up.sizeBytes);

    await files.discard(up);
    expect(storage.objects.size).toBe(0);
  });

  it("still serves pages when Storage cannot sign URLs (signatures and attachments alike)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const files = createFilesService({
      bucket: "b",
      storage: { ...createMemoryStorage(), signedUrls: async () => { throw new StorageError("down"); } },
    });
    expect((await files.signedUrls(["a.png"])).size).toBe(0);
    spy.mockRestore();
  });
});

describe("attachments", () => {
  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const PDF = Buffer.from("%PDF-1.7\n%\xe2\xe3\n");
  const PNG = decodeSignature(TINY_PNG);
  const rejects = (bytes: unknown, kind: "invoice" | "photo" | "document", message: RegExp) => {
    const err = (() => { try { checkAttachment(bytes, kind); } catch (e) { return e; } })() as HttpError;
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect((err.details as { message: string }[])[0].message).toMatch(message);
  };

  it("accepts images and PDFs by their content", () => {
    expect(checkAttachment(JPEG, "photo")).toBe("image/jpeg");
    expect(checkAttachment(PNG, "invoice")).toBe("image/png");
    expect(checkAttachment(PDF, "document")).toBe("application/pdf");
  });

  it("refuses empty bodies, other types, oversized files and PDFs as photos", () => {
    rejects(Buffer.alloc(0), "photo", /request body/);
    rejects({ some: "json" }, "photo", /request body/);
    rejects(Buffer.from("<html>"), "document", /Only JPEG, PNG, WebP/);
    rejects(Buffer.from("GIF89a"), "photo", /Only JPEG, PNG, WebP/);
    rejects(Buffer.concat([JPEG, Buffer.alloc(ATTACHMENT_MAX_BYTES)]), "photo", /too large \(limit 4 MB\)/);
    rejects(PDF, "photo", /must be an image/);
  });

  it("stores under its real type with our own name, keeping the original as a label", async () => {
    const storage = createMemoryStorage();
    const files = createFilesService({ storage, bucket: "rpw-files", now: () => new Date("2026-11-01T10:00:00Z") });
    const up = await files.storeAttachment(PDF, "invoice", "Dell invoice.pdf");
    expect(up.path).toMatch(/^attachments\/2026\/11\/[0-9a-f-]{36}\.pdf$/);
    expect(up).toMatchObject({ contentType: "application/pdf", purpose: "invoice", fileName: "Dell invoice.pdf", sizeBytes: PDF.length });
    expect(storage.objects.get(up.path)?.contentType).toBe("application/pdf");
  });

  it("uploads nothing when the file is refused", async () => {
    const storage = createMemoryStorage();
    const files = createFilesService({ storage, bucket: "b" });
    await expect(files.storeAttachment(Buffer.from("not a file"), "document", "x.txt")).rejects.toBeInstanceOf(HttpError);
    expect(storage.objects.size).toBe(0);
  });
});
