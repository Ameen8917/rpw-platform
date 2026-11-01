import { z } from "zod";

/* Same default as the screen's rows-per-page choice (10, 20, 50, 100) */
export const AUDIT_PAGE_SIZE = 10;

/* One page of the trail, newest first. q searches action, reference, detail and the actor's name. */
export const listAuditQuery = z.object({
  ref: z.string().trim().min(1).max(100).optional(),
  q: z.string().trim().max(100).optional().transform((v) => v || undefined),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(AUDIT_PAGE_SIZE),
}).strict();
export type ListAuditQuery = z.infer<typeof listAuditQuery>;
