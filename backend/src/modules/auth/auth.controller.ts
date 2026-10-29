import type { Request, RequestHandler, Response } from "express";
import type { z } from "zod";
import type { OrgService } from "../org/org.service.js";
import { currentAuth } from "./auth.middleware.js";
import type { loginAsBody, loginBody } from "./auth.schemas.js";
import type { AuthService, RequestMeta } from "./auth.service.js";
import { clearSessionCookie, readSessionCookie, setSessionCookie, type CookieSettings } from "./session-cookie.js";

const meta = (req: Request): RequestMeta => ({ ip: req.ip ?? null, userAgent: req.get("user-agent") ?? null });

export function createAuthController(auth: AuthService, org: OrgService, cookie: CookieSettings) {
  const started = (res: Response, s: Awaited<ReturnType<AuthService["login"]>>) => {
    setSessionCookie(res, cookie, s.token, s.expiresAt);
    res.json({ user: s.user, permissions: s.permissions, expiresAt: s.expiresAt.toISOString() });
  };

  const login: RequestHandler = async (req, res) => {
    const { empCode, password } = res.locals.validated.body as z.infer<typeof loginBody>;
    started(res, await auth.login(empCode, password, meta(req)));
  };

  const me: RequestHandler = (_req, res) => {
    const { user, permissions } = currentAuth(res);
    res.json({ user, permissions });
  };

  const logout: RequestHandler = async (req, res) => {
    const token = readSessionCookie(req);
    if (token) await auth.logout(token);
    clearSessionCookie(res, cookie);
    res.status(204).end();
  };

  /* Development only: people who can sign in, for the role switcher on the sign-in screen */
  const devUsers: RequestHandler = async (_req, res) => {
    const users = (await org.users()).filter((u) => !u.noLogin && !u.inactive);
    res.json(users.map(({ id, name, title, role, empCode }) => ({ id, name, title, role, empCode })));
  };

  const devLoginAs: RequestHandler = async (req, res) => {
    const { userId } = res.locals.validated.body as z.infer<typeof loginAsBody>;
    started(res, await auth.loginAs(userId, meta(req)));
  };

  return { login, me, logout, devUsers, devLoginAs };
}
