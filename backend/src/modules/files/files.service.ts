import { createHash, randomUUID } from "node:crypto";
import type { Transaction } from "sequelize";
import { HttpError } from "../../lib/http-error.js";
import type { FilePurpose } from "./files.models.js";
import { filesRepository, type FilesRepository } from "./files.repository.js";
import type { FileStorage } from "./storage.js";

export const SIGNATURE_MAX_BYTES = 256 * 1024;
/** Signed URLs are handed out per request, so they only need to outlive one page view */
export const SIGNED_URL_TTL_SECONDS = 10 * 60;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;

/** Uploaded to Storage, not yet recorded in the database */
export interface PendingUpload {
  id: string;
  bucket: string;
  path: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  purpose: FilePurpose;
}

/* Decodes a signature pad's PNG data URL, checking it really is a PNG of sensible size */
export function decodeSignature(dataUrl: string): Buffer {
  const m = PNG_DATA_URL.exec(dataUrl);
  const bytes = m ? Buffer.from(m[1], "base64") : null;
  if (!bytes || bytes.length <= PNG_MAGIC.length || !bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
    throw HttpError.badRequest("Request is invalid", [{ location: "body", path: "signature", message: "Not a PNG signature image" }]);
  }
  if (bytes.length > SIGNATURE_MAX_BYTES) {
    throw HttpError.badRequest("Request is invalid", [{ location: "body", path: "signature", message: "Signature image is too large" }]);
  }
  return bytes;
}

/* Storage is not transactional, so saving a file is two steps: upload first (store*), then
   record() inside the caller's database transaction. If that transaction fails, discard()
   removes the orphaned upload. */
export function createFilesService(opts: { storage: FileStorage; bucket: string; repo?: FilesRepository; now?: () => Date }) {
  const repo = opts.repo ?? filesRepository;
  const now = opts.now ?? (() => new Date());

  return {
    async storeSignature(dataUrl: string): Promise<PendingUpload> {
      const bytes = decodeSignature(dataUrl);
      const id = randomUUID();
      const d = now();
      const path = `signatures/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${id}.png`;
      await opts.storage.upload(path, bytes, "image/png");
      return {
        id, bucket: opts.bucket, path, contentType: "image/png", sizeBytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"), purpose: "signature",
      };
    },

    async record(upload: PendingUpload, uploadedBy: string, transaction: Transaction) {
      await repo.create({ ...upload, uploadedBy }, transaction);
    },

    /* Best effort: a leftover object is harmless (private, unreferenced), a thrown error here is not */
    async discard(upload: PendingUpload | null) {
      if (!upload) return;
      await opts.storage.remove([upload.path]).catch((err: Error) => console.error(`Could not remove ${upload.path}: ${err.message}`));
    },

    /* A Storage outage must not break reading assets: signatures are then shown as missing */
    signedUrls(paths: string[]): Promise<Map<string, string>> {
      return opts.storage.signedUrls([...new Set(paths)], SIGNED_URL_TTL_SECONDS).catch((err: Error) => {
        console.error(`Could not sign file URLs: ${err.message}`);
        return new Map();
      });
    },
  };
}

export type FilesService = ReturnType<typeof createFilesService>;
