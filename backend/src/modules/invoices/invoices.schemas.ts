import { z } from "zod";
import { CATEGORIES } from "../assets/asset-rules.js";

/* Size caps. Claude takes images up to 5 MB once base64-encoded (about 3.75 MB of file), so
   images stop below that; the browser shrinks large phone photos before sending them. */
export const INVOICE_LIMITS = {
  imageBytes: 3.5 * 1024 * 1024,
  pdfBytes: 8 * 1024 * 1024,
} as const;

export type InvoiceMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf";

/* The type comes from the file's first bytes, not from the Content-Type the client claims */
export function sniffInvoiceType(bytes: Buffer): InvoiceMediaType | null {
  const starts = (sig: number[], at = 0) => bytes.length >= at + sig.length && sig.every((b, i) => bytes[at + i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";                        // %PDF-
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0x47, 0x49, 0x46, 0x38])) return "image/gif";                                     // GIF8
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp"; // RIFF....WEBP
  return null;
}

/* JSON schema Claude's answer is constrained to (structured outputs). Every key is required and
   nullable, so "not printed on the invoice" is an explicit null rather than a missing key. */
const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });
export const invoiceJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["vendor", "invoiceNo", "invoiceDate", "total", "subtotal", "tax", "items"],
  properties: {
    vendor: nullable({ type: "string" }),
    invoiceNo: nullable({ type: "string" }),
    invoiceDate: nullable({ type: "string", description: "YYYY-MM-DD" }),
    total: nullable({ type: "number", description: "Final amount payable" }),
    subtotal: nullable({ type: "number" }),
    tax: nullable({ type: "number", description: "Total GST" }),
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "make", "model", "serial", "category", "unitCost", "quantity", "warrantyMonths", "bundled"],
        properties: {
          name: { type: "string" },
          make: nullable({ type: "string" }),
          model: nullable({ type: "string" }),
          serial: nullable({ type: "string" }),
          category: nullable({ type: "string", enum: [...CATEGORIES] }),
          unitCost: nullable({ type: "number" }),
          quantity: nullable({ type: "integer" }),
          warrantyMonths: nullable({ type: "integer" }),
          bundled: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

/* The model's answer is still checked: anything out of range or malformed becomes null (or is
   dropped), field by field, so one bad value does not lose the rest of the invoice. */
const text = (max: number) =>
  z.string().transform((s) => s.trim().slice(0, max)).transform((s) => s || null).nullable().catch(null);
const amount = z.number().finite().min(0).max(1e10).nullable().catch(null);
const whole = (min: number, max: number) => z.number().int().min(min).max(max).nullable().catch(null);
const isoDate = z.string().trim()
  .refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s))
  .nullable().catch(null);

const item = z.object({
  name: text(200),
  make: text(100),
  model: text(100),
  serial: text(100),
  category: z.enum(CATEGORIES).nullable().catch(null),
  unitCost: amount,
  quantity: whole(1, 10_000),
  warrantyMonths: whole(0, 240),
  bundled: z.array(z.unknown()).catch([])
    .transform((xs) => xs.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, 100)).filter(Boolean).slice(0, 20)),
});

export const extractedInvoice = z.object({
  vendor: text(200),
  invoiceNo: text(100),
  invoiceDate: isoDate,
  total: amount,
  subtotal: amount,
  tax: amount,
  items: z.array(z.unknown()).catch([]).transform((xs) =>
    xs.flatMap((x) => {
      const r = item.safeParse(x);
      return r.success && r.data.name ? [{ ...r.data, name: r.data.name }] : [];
    }).slice(0, 50)),
});

export type ExtractedInvoice = z.infer<typeof extractedInvoice>;
