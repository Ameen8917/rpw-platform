import { Router } from "express";

export interface HealthDeps {
  /** Resolves when the database answers a trivial query; rejects otherwise */
  checkDatabase: () => Promise<unknown>;
}

/* GET /api/health — 200 when the API and database are reachable, 503 when the database is not.
   Used by uptime checks and to confirm the Supabase connection from a running server. */
export function healthRoutes({ checkDatabase }: HealthDeps): Router {
  const router = Router();
  router.get("/", async (_req, res) => {
    const started = Date.now();
    try {
      await checkDatabase();
      res.json({ status: "ok", database: "ok", latencyMs: Date.now() - started });
    } catch {
      res.status(503).json({ status: "degraded", database: "unreachable" });
    }
  });
  return router;
}
