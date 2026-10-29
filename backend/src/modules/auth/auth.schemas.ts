import { z } from "zod";

export const loginBody = z.object({
  empCode: z.string().trim().min(1, "Employee code is required").max(40),
  password: z.string().min(1, "Password is required").max(200),
}).strict();

export const loginAsBody = z.object({
  userId: z.string().trim().min(1).max(40),
}).strict();
