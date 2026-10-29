import cors from "cors";
import express from "express";
import helmet from "helmet";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import { healthRoutes, type HealthDeps } from "./modules/health/health.routes.js";

export interface AppDeps extends HealthDeps {
  corsOrigin: string;
}

/* Builds the Express app from its dependencies, so tests can run it without a real database.
   Each feature module contributes a router mounted under /api/<module>. */
export function createApp(deps: AppDeps) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: deps.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/health", healthRoutes(deps));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
