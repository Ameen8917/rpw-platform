import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { AssetCategory } from "../../types";

/* Shape returned by invoice extraction. Any field the invoice does not clearly state is null. */
export interface ExtractedInvoice {
  vendor: string | null;
  invoiceNo: string | null;
  invoiceDate: string | null;   // YYYY-MM-DD
  total: number | null;
  subtotal?: number | null;
  tax?: number | null;
  items: ExtractedItem[];
}
export interface ExtractedItem {
  name: string;
  make: string | null;
  model: string | null;
  serial: string | null;
  category: AssetCategory | null;
  unitCost: number | null;
  quantity: number | null;
  warrantyMonths: number | null;
  bundled: string[];
}

export interface InvoiceReadingStatus {
  aiReading: boolean;
  maxImageBytes: number;
  maxPdfBytes: number;
}

/* Invoices are always entered by hand; AI reading (decision D6) is an optional button, shown
   only when the server has it set up and only run when clicked. The API key stays on the server. */
export const invoiceApi = {
  status: () => api.get<InvoiceReadingStatus>("/invoices/status"),
  extract: (file: Blob) => api.upload<ExtractedInvoice>("/invoices/extract", file),
};

const OFF: InvoiceReadingStatus = { aiReading: false, maxImageBytes: 0, maxPdfBytes: 0 };

/** null while asking the server; "off" if it cannot be asked */
export function useInvoiceReading(): InvoiceReadingStatus | null {
  const [status, setStatus] = useState<InvoiceReadingStatus | null>(null);
  useEffect(() => {
    let live = true;
    invoiceApi.status().then((s) => live && setStatus(s), () => live && setStatus(OFF));
    return () => { live = false; };
  }, []);
  return status;
}

/* Phone photos are often several MB; Claude reads at about 1,600 px anyway, so large images are
   scaled down to JPEG before upload. PDFs and small images go as they are. */
const MAX_EDGE = 2000;
export async function prepareInvoiceFile(file: File, status: InvoiceReadingStatus): Promise<Blob> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap === "undefined") return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= status.maxImageBytes * 0.9) { bitmap.close(); return file; }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
  return blob ?? file;
}

/** Reads an invoice for asset-level detail: one request, every line item */
export async function readInvoiceAssets(file: File, status: InvoiceReadingStatus): Promise<ExtractedInvoice> {
  return invoiceApi.extract(await prepareInvoiceFile(file, status));
}

/* A line of 3 laptops is 3 assets, each with its own code and serial; capped so a misread
   quantity cannot flood the form */
export function expandQuantities(items: ExtractedItem[], maxRows = 50): ExtractedItem[] {
  const out: ExtractedItem[] = [];
  for (const it of items) {
    const n = Math.max(1, Math.min(it.quantity ?? 1, 20));
    for (let i = 0; i < n && out.length < maxRows; i++) out.push(n > 1 ? { ...it, quantity: 1, serial: i === 0 ? it.serial : null } : it);
  }
  return out;
}
