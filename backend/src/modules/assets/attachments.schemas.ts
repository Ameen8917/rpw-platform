import { z } from "zod";
import { ATTACHMENT_KINDS } from "./assets.models.js";

/* The file itself is the raw request body; what it is travels in the query string.
   The name is only a label: path separators and control characters are replaced. */
export const attachmentQuery = z.object({
  kind: z.enum(ATTACHMENT_KINDS),
  name: z.string().trim().min(1, "File name is required").max(200)
    .transform((n) => [...n].map((ch) => (ch === "/" || ch === "\\" || ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? "_" : ch)).join("")),
  caption: z.string().trim().max(200).default(""),
}).strict();
export type AttachmentQuery = z.infer<typeof attachmentQuery>;

export const attachmentParams = z.object({
  id: z.string().uuid("Not an asset ID"),
  attachmentId: z.string().uuid("Not an attachment ID"),
});

export const removeAttachmentBody = z.object({}).strict();
