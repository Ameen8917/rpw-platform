import { Router, type RequestHandler } from "express";
import { validate } from "../../middleware/validate.js";
import type { OrgService } from "../org/org.service.js";
import { createAuthController } from "./auth.controller.js";
import { loginAsBody, loginBody } from "./auth.schemas.js";
import type { AuthService } from "./auth.service.js";
import type { CookieSettings } from "./session-cookie.js";

export interface AuthRouteOptions {
  cookie: CookieSettings;
  /** Mounts /dev/* ("sign in as" without a password). Env validation forbids it in production. */
  devLoginEnabled: boolean;
}

/* POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
   Dev only: GET /api/auth/dev/users, POST /api/auth/dev/login-as */
export function authRoutes(auth: AuthService, org: OrgService, requireAuth: RequestHandler, opts: AuthRouteOptions): Router {
  const c = createAuthController(auth, org, opts.cookie);
  const router = Router();
  router.post("/login", validate({ body: loginBody }), c.login);
  router.post("/logout", c.logout);
  router.get("/me", requireAuth, c.me);
  if (opts.devLoginEnabled) {
    router.get("/dev/users", c.devUsers);
    router.post("/dev/login-as", validate({ body: loginAsBody }), c.devLoginAs);
  }
  return router;
}
