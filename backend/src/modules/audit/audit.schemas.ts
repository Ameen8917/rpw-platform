import { z } from "zod";

export const listAuditQuery = z.object({
  ref: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
}).strict();
