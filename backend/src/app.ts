import cors from "cors";
import express from "express";
import helmet from "helmet";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import { assetRoutes, custodyRoutes } from "./modules/assets/assets.routes.js";
import type { AssetService } from "./modules/assets/assets.service.js";
import type { AttachmentService } from "./modules/assets/attachments.service.js";
import type { CustodyService } from "./modules/assets/custody.service.js";
import { auditRoutes } from "./modules/audit/audit.routes.js";
import type { AuditService } from "./modules/audit/audit.service.js";
import { requireAuth } from "./modules/auth/auth.middleware.js";
import { authRoutes, type AuthRouteOptions } from "./modules/auth/auth.routes.js";
import type { AuthService } from "./modules/auth/auth.service.js";
import { healthRoutes, type HealthDeps } from "./modules/health/health.routes.js";
import { invoiceRoutes } from "./modules/invoices/invoices.routes.js";
import type { InvoiceService } from "./modules/invoices/invoices.service.js";
import { orgRoutes } from "./modules/org/org.routes.js";
import type { OrgService } from "./modules/org/org.service.js";

export interface AppDeps extends HealthDeps, AuthRouteOptions {
  corsOrigin: string;
  auth: AuthService;
  org: OrgService;
  assets: AssetService;
  custody: CustodyService;
  attachments: AttachmentService;
  audit: AuditService;
  invoices: InvoiceService;
}

/* Builds the Express app from its dependencies, so tests can run it without a real database.
   Each feature module contributes a router mounted under /api/<module>. */
export function createApp(deps: AppDeps) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: deps.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  const signedIn = requireAuth(deps.auth);
  app.use("/api/health", healthRoutes(deps));
  app.use("/api/auth", authRoutes(deps.auth, deps.org, signedIn, deps));
  app.use("/api/org", orgRoutes(deps.org, signedIn));
  app.use("/api/assets", assetRoutes(deps.assets, deps.custody, deps.attachments, signedIn));
  app.use("/api/custody", custodyRoutes(deps.custody, signedIn));
  app.use("/api/audit", auditRoutes(deps.audit, signedIn));
  app.use("/api/invoices", invoiceRoutes(deps.invoices, signedIn));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
