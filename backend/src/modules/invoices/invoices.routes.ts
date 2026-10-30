import express, { Router, type RequestHandler } from "express";
import { createInvoiceController } from "./invoices.controller.js";
import { INVOICE_LIMITS } from "./invoices.schemas.js";
import type { InvoiceService } from "./invoices.service.js";

/* /api/invoices — the file is the raw request body (Content-Type: the file's type), so no
   multipart parser is needed; the service checks the bytes themselves. */
export function invoiceRoutes(invoices: InvoiceService, requireAuth: RequestHandler): Router {
  const c = createInvoiceController(invoices);
  const router = Router();
  router.use(requireAuth);
  router.get("/status", c.status);
  router.post("/extract", express.raw({ type: () => true, limit: Math.max(INVOICE_LIMITS.imageBytes, INVOICE_LIMITS.pdfBytes) }), c.extract);
  return router;
}
