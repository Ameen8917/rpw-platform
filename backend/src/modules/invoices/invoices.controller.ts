import type { RequestHandler } from "express";
import { currentAuth } from "../auth/auth.middleware.js";
import type { InvoiceService } from "./invoices.service.js";

export function createInvoiceController(invoices: InvoiceService) {
  const status: RequestHandler = (_req, res) => {
    res.json(invoices.status(currentAuth(res)));
  };
  const extract: RequestHandler = async (req, res) => {
    res.json(await invoices.extract(currentAuth(res), req.body));
  };
  return { status, extract };
}
