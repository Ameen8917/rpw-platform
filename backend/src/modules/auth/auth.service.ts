import { createHmac, randomBytes } from "node:crypto";
import { HttpError } from "../../lib/http-error.js";
import { toUserDto, type UserDto } from "../org/org.dto.js";
import type { User } from "../org/org.models.js";
import { orgRepository, type OrgRepository } from "../org/org.repository.js";
import { authRepository, type AuthRepository } from "./auth.repository.js";
import { createThrottle, type Throttle } from "./login-throttle.js";
import { verifyAgainstDummy, verifyPassword } from "./password.js";
import { permissionsFor, type Permissions } from "./permissions.js";

export interface AuthContext {
  user: UserDto;
  permissions: Permissions;
}
export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}
export interface AuthServiceOptions {
  sessionSecret: string;
  sessionTtlHours: number;
  orgRepo?: OrgRepository;
  authRepo?: AuthRepository;
  /* Failed sign-ins: per employee code (guessing one account) and per IP (spraying many) */
  accountThrottle?: Throttle;
  ipThrottle?: Throttle;
  now?: () => Date;
}

const INVALID = () => new HttpError(401, "invalid_credentials", "Employee code or password is incorrect");

export function createAuthService(opts: AuthServiceOptions) {
  const orgRepo = opts.orgRepo ?? orgRepository;
  const authRepo = opts.authRepo ?? authRepository;
  const accountThrottle = opts.accountThrottle ?? createThrottle({ maxFailures: 5, windowMs: 15 * 60_000 });
  const ipThrottle = opts.ipThrottle ?? createThrottle({ maxFailures: 30, windowMs: 15 * 60_000 });
  const now = opts.now ?? (() => new Date());

  /* The cookie carries a random token; the database stores only its keyed hash */
  const hashToken = (token: string) => createHmac("sha256", opts.sessionSecret).update(token).digest("hex");
  const canSignIn = (u: User | null): u is User => !!u && u.canLogin && !u.inactive;
  const contextFor = (u: User): AuthContext => {
    const user = toUserDto(u);
    return { user, permissions: permissionsFor(user) };
  };

  async function startSession(u: User, meta: RequestMeta) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now().getTime() + opts.sessionTtlHours * 3_600_000);
    await authRepo.deleteExpiredSessions(now());
    await authRepo.createSession({ idHash: hashToken(token), userId: u.id, expiresAt, userAgent: meta.userAgent, ip: meta.ip });
    return { token, expiresAt, ...contextFor(u) };
  }

  return {
    async login(empCode: string, password: string, meta: RequestMeta) {
      const accountKey = `emp:${empCode.toLowerCase()}`;
      const ipKey = `ip:${meta.ip ?? "unknown"}`;
      const wait = Math.max(accountThrottle.retryAfter(accountKey), ipThrottle.retryAfter(ipKey));
      if (wait) {
        throw new HttpError(429, "too_many_attempts",
          `Too many failed sign-ins. Try again in ${Math.ceil(wait / 60)} minute(s).`, { retryAfterSeconds: wait });
      }

      const u = await orgRepo.findUserByEmpCode(empCode);
      const ok = canSignIn(u) && u.passwordHash
        ? await verifyPassword(password, u.passwordHash)
        : await verifyAgainstDummy(password);
      if (!ok) {
        accountThrottle.fail(accountKey);
        ipThrottle.fail(ipKey);
        throw INVALID();
      }
      accountThrottle.reset(accountKey);
      return startSession(u!, meta);
    },

    /* Development "sign in as" — the route is only mounted when DEV_LOGIN_ENABLED */
    async loginAs(userId: string, meta: RequestMeta) {
      const u = await orgRepo.findUserById(userId);
      if (!canSignIn(u)) throw HttpError.notFound("No user with that ID can sign in");
      return startSession(u, meta);
    },

    /* null when the token is unknown, expired, or its user can no longer sign in */
    async resolve(token: string): Promise<AuthContext | null> {
      const idHash = hashToken(token);
      const session = await authRepo.findSessionWithUser(idHash);
      if (!session) return null;
      if (session.expiresAt <= now()) {
        await authRepo.deleteSession(idHash);
        return null;
      }
      return canSignIn(session.user ?? null) ? contextFor(session.user!) : null;
    },

    async logout(token: string) {
      await authRepo.deleteSession(hashToken(token));
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
