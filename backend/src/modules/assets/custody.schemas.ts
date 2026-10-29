import { z } from "zod";
import { RETURN_CONDITIONS } from "./assets.models.js";

/* A signature pad's PNG as a data URL. The bytes are checked again when decoded (files.service). */
const signature = z.string().max(400_000, "Signature image is too large")
  .startsWith("data:image/png;base64,", "Must be a PNG image (data URL)");

export const issueBody = z.object({
  userId: z.string().trim().min(1, "Choose who receives it").max(40),
  /** in_app: they confirm from their own login later; signature: they sign now, in person */
  method: z.enum(["in_app", "signature"]),
  signature: signature.nullish(),
  note: z.string().trim().max(500).optional(),
}).strict().superRefine((b, ctx) => {
  if (b.method === "signature" && !b.signature) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["signature"], message: "Signature is required for a handover" });
  }
  if (b.method === "in_app" && b.signature) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["signature"], message: "Not used when they accept in app" });
  }
});
export type IssueInput = z.infer<typeof issueBody>;

export const acceptBody = z.object({}).strict();

export const returnBody = z.object({
  condition: z.enum(RETURN_CONDITIONS),
  /** Items from the handover list that did not come back */
  missing: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  /** Signature of the person returning it */
  signature,
}).strict();
export type ReturnInput = z.infer<typeof returnBody>;

export const custodyQuery = z.object({
  dealershipId: z.string().trim().max(40).optional(),
  deptId: z.string().trim().max(40).optional(),
  facilityId: z.string().trim().max(40).optional(),
  userId: z.string().trim().max(40).optional(),
}).strict();
export type CustodyQuery = z.infer<typeof custodyQuery>;
