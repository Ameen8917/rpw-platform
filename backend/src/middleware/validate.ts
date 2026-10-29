import type { RequestHandler } from "express";
import type { z, ZodTypeAny } from "zod";
import { HttpError } from "../lib/http-error.js";

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export type Validated<S extends Schemas> = {
  [K in keyof S]: S[K] extends ZodTypeAny ? z.infer<S[K]> : never;
};

/* Validates request parts with Zod. Parsed values (with defaults and coercion applied)
   go to res.locals.validated; Express 5 makes req.query read-only, so it is not overwritten. */
export function validate<S extends Schemas>(schemas: S): RequestHandler {
  return (req, res, next) => {
    const out: Record<string, unknown> = {};
    const issues: { location: string; path: string; message: string }[] = [];
    for (const part of ["params", "query", "body"] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (result.success) out[part] = result.data;
      else for (const i of result.error.issues) issues.push({ location: part, path: i.path.join("."), message: i.message });
    }
    if (issues.length) return next(HttpError.badRequest("Request is invalid", issues));
    res.locals.validated = out;
    next();
  };
}
