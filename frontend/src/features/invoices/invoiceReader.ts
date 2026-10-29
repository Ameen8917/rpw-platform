import type { AssetCategory } from "../../types";

/* Shape returned by invoice extraction. Any field the invoice does not clearly state is null. */
export interface ExtractedInvoice {
  vendor: string | null;
  invoiceNo: string | null;
  invoiceDate: string | null;   // YYYY-MM-DD
  total: number | null;
  subtotal?: number | null;
  tax?: number | null;
  items: {
    name: string;
    make: string | null;
    model: string | null;
    serial: string | null;
    category: AssetCategory | null;
    unitCost: number | null;
    quantity: number | null;
    warrantyMonths: number | null;
    bundled: string[];
  }[];
}

/* Reads an invoice for asset-level detail — one call, every line item.
   The prototype called the Anthropic API straight from the browser, which only worked inside
   the Claude.ai sandbox and would expose an API key anywhere else. Extraction now belongs to
   the backend (POST /api/invoices/extract — see docs/invoice-extraction.md). Until that
   endpoint exists this rejects, and both callers fall back to manual entry. */
export async function readInvoiceAssets(file: File): Promise<ExtractedInvoice> {
  const body = new FormData();
  body.append("file", file);
  const resp = await fetch("/api/invoices/extract", { method: "POST", body });
  if (!resp.ok) throw new Error(`Invoice extraction failed (${resp.status})`);
  return resp.json();
}
