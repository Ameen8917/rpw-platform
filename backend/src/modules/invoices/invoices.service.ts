import { HttpError } from "../../lib/http-error.js";
import type { AuthContext } from "../auth/auth.service.js";
import { createThrottle } from "../auth/login-throttle.js";
import type { InvoiceReader } from "./invoice-reader.js";
import { extractedInvoice, INVOICE_LIMITS, sniffInvoiceType, type ExtractedInvoice } from "./invoices.schemas.js";

const fileError = (message: string) => HttpError.badRequest("Request is invalid", [{ location: "body", path: "file", message }]);

/* Optional AI reading of invoices (decision D6). Manual entry never depends on it: without a
   reader (no ANTHROPIC_API_KEY) the status says so and extract answers 503. Each person gets
   a number of readings per hour, which caps the cost. */
export function createInvoiceService(opts: { reader: InvoiceReader | null; hourlyLimit: number; now?: () => number }) {
  /* The throttle counts readings, not failures: every reading is a "use" in the window */
  const uses = createThrottle({ maxFailures: opts.hourlyLimit, windowMs: 60 * 60 * 1000, now: opts.now });
  const allowed = (auth: AuthContext) => auth.permissions.canAddExisting || auth.permissions.canProcure;

  return {
    status(auth: AuthContext) {
      return {
        aiReading: !!opts.reader && allowed(auth),
        maxImageBytes: INVOICE_LIMITS.imageBytes,
        maxPdfBytes: INVOICE_LIMITS.pdfBytes,
      };
    },

    async extract(auth: AuthContext, body: unknown): Promise<ExtractedInvoice> {
      if (!allowed(auth)) throw HttpError.forbidden();
      if (!opts.reader) {
        throw new HttpError(503, "invoice_reading_off", "Automatic invoice reading is not set up on this server. Enter the details by hand.");
      }
      if (!Buffer.isBuffer(body) || body.length === 0) throw fileError("Send the invoice file (image or PDF) as the request body");
      const type = sniffInvoiceType(body);
      if (!type) throw fileError("Only JPEG, PNG, GIF, WebP images and PDF files can be read");
      const max = type === "application/pdf" ? INVOICE_LIMITS.pdfBytes : INVOICE_LIMITS.imageBytes;
      if (body.length > max) throw fileError(`File is too large to read (limit ${(max / 1024 / 1024).toFixed(1)} MB)`);

      const wait = uses.retryAfter(auth.user.id);
      if (wait) {
        throw new HttpError(429, "too_many_readings", "Invoice reading limit reached for this hour. Enter the details by hand or try later.",
          { retryAfterSeconds: wait });
      }
      uses.fail(auth.user.id);

      const { output, inputTokens, outputTokens } = await opts.reader.read(body, type);
      console.info(`Invoice read for ${auth.user.id}: ${type}, ${inputTokens} input / ${outputTokens} output tokens`);
      const parsed = extractedInvoice.safeParse(output);
      if (!parsed.success) throw new HttpError(422, "invoice_unreadable", "The invoice could not be read. Enter the details by hand.");
      return parsed.data;
    },
  };
}

export type InvoiceService = ReturnType<typeof createInvoiceService>;
