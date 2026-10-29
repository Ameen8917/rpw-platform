import type { RequestHandler, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import type { AuthContext, AuthService } from "./auth.service.js";
import { readSessionCookie } from "./session-cookie.js";

/* Rejects with 401 unless the request carries a valid session; puts the signed-in user and
   their permissions on res.locals.auth for downstream handlers. */
export function requireAuth(auth: AuthService): RequestHandler {
  return async (req, res, next) => {
    const token = readSessionCookie(req);
    const ctx = token ? await auth.resolve(token) : null;
    if (!ctx) return next(HttpError.unauthorized());
    res.locals.auth = ctx;
    next();
  };
}

export function currentAuth(res: Response): AuthContext {
  const ctx = res.locals.auth as AuthContext | undefined;
  if (!ctx) throw HttpError.unauthorized();
  return ctx;
}
