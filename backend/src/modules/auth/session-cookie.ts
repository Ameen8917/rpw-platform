import type { CookieOptions, Request, Response } from "express";

export const SESSION_COOKIE = "rpw_session";

export interface CookieSettings {
  /** HTTPS-only cookie; true in production */
  secure: boolean;
}

/* httpOnly: page scripts cannot read it. SameSite=Strict: browsers do not send it on
   cross-site requests, which blocks CSRF. Scoped to /api. */
function options(settings: CookieSettings, expires?: Date): CookieOptions {
  return { httpOnly: true, sameSite: "strict", secure: settings.secure, path: "/api", ...(expires ? { expires } : {}) };
}

export function setSessionCookie(res: Response, settings: CookieSettings, token: string, expires: Date) {
  res.cookie(SESSION_COOKIE, token, options(settings, expires));
}

export function clearSessionCookie(res: Response, settings: CookieSettings) {
  res.clearCookie(SESSION_COOKIE, options(settings));
}

/* Express 5 does not parse cookies; this reads just ours */
export function readSessionCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === SESSION_COOKIE) {
      const value = part.slice(eq + 1).trim();
      return value ? decodeURIComponent(value) : null;
    }
  }
  return null;
}
