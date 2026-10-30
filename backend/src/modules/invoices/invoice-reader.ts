import Anthropic from "@anthropic-ai/sdk";
import { HttpError } from "../../lib/http-error.js";
import { CATEGORIES } from "../assets/asset-rules.js";
import { invoiceJsonSchema, type InvoiceMediaType } from "./invoices.schemas.js";

/** Reads one invoice file and returns the model's raw JSON answer (checked by the service) */
export interface InvoiceReader {
  read(file: Buffer, mediaType: InvoiceMediaType): Promise<{ output: unknown; inputTokens: number; outputTokens: number }>;
}

/* Carried over from the prototype (docs/invoice-extraction.md); the reply format is now
   enforced by the JSON schema instead of being asked for in the prompt. */
const PROMPT = `This is a purchase invoice from an Indian vendor for equipment being recorded as a fixed asset.

Read it into the given fields:
- vendor, invoiceNo, invoiceDate (YYYY-MM-DD), total (final amount payable), subtotal and tax (total GST) if printed.
- items: one entry per distinct product line.
  - category: exactly one of ${CATEGORIES.join(" | ")}, or null if none fits.
  - unitCost: cost of one unit excluding GST if separable, else the line amount.
  - serial: serial, IMEI or machine number if printed.
  - warrantyMonths: number of months if stated.
  - bundled: accessories listed as included with that item (chargers, cables, cases); empty if none.

Use null for anything not clearly stated. Do not guess serial numbers or model codes. All amounts as plain numbers in rupees.`;

const unreadable = (why: string) => new HttpError(422, "invoice_unreadable", why);
const unavailable = () => new HttpError(503, "invoice_reading_unavailable", "Invoice reading is unavailable right now. Try again later or enter the details by hand.");

/* Claude through the official SDK. The API key stays on the server; only the file goes out. */
export function createClaudeInvoiceReader(opts: { apiKey: string; model: string; fetch?: typeof fetch }): InvoiceReader {
  const client = new Anthropic({ apiKey: opts.apiKey, timeout: 60_000, maxRetries: 1, ...(opts.fetch ? { fetch: opts.fetch } : {}) });

  return {
    async read(file, mediaType) {
      const data = file.toString("base64");
      const source: Anthropic.ContentBlockParam = mediaType === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: mediaType, data } }
        : { type: "image", source: { type: "base64", media_type: mediaType, data } };

      let response: Anthropic.Message;
      try {
        response = await client.messages.create({
          model: opts.model,
          max_tokens: 16000,
          output_config: { effort: "medium", format: { type: "json_schema", schema: invoiceJsonSchema } },
          messages: [{ role: "user", content: [source, { type: "text", text: PROMPT }] }],
        });
      } catch (err) {
        if (err instanceof Anthropic.BadRequestError) {
          console.warn(`Invoice reading: request refused (${err.message})`);
          throw unreadable("This file could not be read. Try a clearer photo or a PDF, or enter the details by hand.");
        }
        if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError || err instanceof Anthropic.NotFoundError) {
          console.error(`Invoice reading is misconfigured (check ANTHROPIC_API_KEY and INVOICE_AI_MODEL): ${err.status}`);
          throw unavailable();
        }
        if (err instanceof Anthropic.APIError) {
          console.warn(`Invoice reading failed: ${err.status ?? "connection"} ${err.message}`);
          throw unavailable();
        }
        throw err;
      }

      if (response.stop_reason === "refusal") throw unreadable("This file could not be read as an invoice. Enter the details by hand.");
      if (response.stop_reason === "max_tokens") throw unreadable("This invoice has too many lines to read at once. Enter the details by hand.");
      const answer = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      let output: unknown;
      try {
        output = JSON.parse(answer);
      } catch {
        throw unreadable("The invoice could not be read. Enter the details by hand.");
      }
      return { output, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
    },
  };
}
