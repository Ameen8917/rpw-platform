import { useCallback, useEffect, useState } from "react";
import { ApiError, api, setUnauthorizedHandler } from "../../lib/api";
import type { Permissions } from "../../domain/permissions";
import type { User } from "../../types";

/* Signed-in user and the permissions the server resolved for them (the same keys as P()) */
export interface SessionInfo {
  user: User;
  permissions: Permissions;
}

/** People offered by the development "sign in as" switcher */
export type DevUser = Pick<User, "id" | "name" | "title" | "role" | "empCode">;

export const sessionApi = {
  me: () => api.get<SessionInfo>("/auth/me"),
  login: (empCode: string, password: string) => api.post<SessionInfo>("/auth/login", { empCode, password }),
  logout: () => api.post<void>("/auth/logout"),
  /* Only mounted when the backend runs with DEV_LOGIN_ENABLED; otherwise 404 → none */
  devUsers: () => api.get<DevUser[]>("/auth/dev/users").catch(() => [] as DevUser[]),
  loginAs: (userId: string) => api.post<SessionInfo>("/auth/dev/login-as", { userId }),
};

export type SessionState =
  | { status: "loading" }
  | { status: "signedOut"; expired?: boolean }
  | { status: "signedIn"; session: SessionInfo };

export function useSession() {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    let live = true;
    sessionApi.me()
      .then((s) => live && setState({ status: "signedIn", session: s }))
      .catch(() => live && setState({ status: "signedOut" }));
    setUnauthorizedHandler(() => setState({ status: "signedOut", expired: true }));
    return () => { live = false; setUnauthorizedHandler(null); };
  }, []);

  const signedIn = useCallback((s: SessionInfo) => setState({ status: "signedIn", session: s }), []);

  const logout = useCallback(async () => {
    try {
      await sessionApi.logout();
    } catch (err) {
      /* Already signed out on the server is fine; anything else still ends the session here */
      if (!(err instanceof ApiError)) throw err;
    }
    setState({ status: "signedOut" });
  }, []);

  return { state, signedIn, logout };
}
