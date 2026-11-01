import type { AttachmentKind } from "../../types";
import { shrinkImage } from "../invoices/invoiceReader";

/* Same limits as the server (files.service.ts). Uploads go through Vercel's /api rewrite on
   the deployed site, which caps request bodies at about 4.5 MB. */
export const ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;
export const ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const ATTACHMENT_ACCEPT = "image/*,application/pdf";

export const ATTACHMENT_KIND_LABEL: Record<AttachmentKind, string> = { invoice: "Invoice", photo: "Photo", document: "Document" };

/** Why this file cannot be attached as it is, or null if it can */
export function attachmentProblem(kind: AttachmentKind, type: string, size: number): string | null {
  if (!ATTACHMENT_TYPES.includes(type)) return "Only JPEG, PNG, WebP images and PDF files can be attached.";
  if (kind === "photo" && !type.startsWith("image/")) return "A photo must be an image.";
  if (size > ATTACHMENT_MAX_BYTES) return `The file is larger than ${ATTACHMENT_MAX_BYTES / 1024 / 1024} MB.`;
  return null;
}

/* Phone photos are scaled down to JPEG, and other image types (HEIC, GIF) converted, so they
   fit the limit; PDFs go as they are. Throws with a message for the person if it still cannot go. */
export async function prepareAttachment(file: File, kind: AttachmentKind): Promise<Blob> {
  const ready = file.type.startsWith("image/")
    ? await shrinkImage(file, ATTACHMENT_MAX_BYTES * 0.9, { force: !ATTACHMENT_TYPES.includes(file.type) })
    : file;
  const problem = attachmentProblem(kind, ready.type, ready.size);
  if (problem) throw new Error(problem);
  return ready;
}

/* The name kept with the file: a JPEG made from a photo gets a matching extension */
export function attachmentName(file: File, ready: Blob): string {
  if (ready === file || ready.type !== "image/jpeg") return file.name;
  return file.name.replace(/\.[^.]*$/, "") + ".jpg";
}

export const fileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
