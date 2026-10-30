import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../lib/api";
import { expandQuantities, readInvoiceAssets, type ExtractedItem } from "./invoiceReader";

afterEach(() => vi.unstubAllGlobals());

const line = (over: Partial<ExtractedItem> = {}): ExtractedItem => ({
  name: "Laptop", make: "Dell", model: "Latitude", serial: "SN1", category: "IT Equipment",
  unitCost: 58000, quantity: 1, warrantyMonths: 12, bundled: [], ...over,
});

describe("api.upload", () => {
  it("sends the file itself with its own type", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const file = new Blob(["%PDF-1.7"], { type: "application/pdf" });
    await api.upload("/invoices/extract", file);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/invoices/extract");
    expect(init.body).toBe(file);
    expect(init.headers["Content-Type"]).toBe("application/pdf");
  });
});

describe("readInvoiceAssets", () => {
  it("posts the invoice and returns what the server read", async () => {
    const answer = { vendor: "Croma", invoiceNo: "C-1", invoiceDate: "2026-10-01", total: 58000, items: [line()] };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(answer), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const file = new File(["%PDF-1.7"], "invoice.pdf", { type: "application/pdf" });
    expect(await readInvoiceAssets(file, { aiReading: true, maxImageBytes: 3_000_000, maxPdfBytes: 8_000_000 })).toEqual(answer);
    expect(fetch.mock.calls[0][1].body).toBe(file);
  });

  it("passes the server's reason on when reading is off", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: "invoice_reading_off", message: "Automatic invoice reading is not set up on this server." } }), { status: 503 })));
    const err = await readInvoiceAssets(new File(["x"], "a.pdf", { type: "application/pdf" }), { aiReading: true, maxImageBytes: 1, maxPdfBytes: 1 }).catch((e) => e);
    expect(err).toMatchObject({ status: 503, code: "invoice_reading_off" });
  });
});

describe("expandQuantities", () => {
  it("makes one entry per unit; the printed serial stays on the first", () => {
    const out = expandQuantities([line({ quantity: 3 }), line({ name: "Mouse", quantity: null, serial: null })]);
    expect(out.map((x) => x.name)).toEqual(["Laptop", "Laptop", "Laptop", "Mouse"]);
    expect(out.map((x) => x.serial)).toEqual(["SN1", null, null, null]);
    expect(out.every((x) => x.quantity === 1 || x.quantity === null)).toBe(true);
  });

  it("caps a misread quantity", () => {
    expect(expandQuantities([line({ quantity: 500 })])).toHaveLength(20);
    expect(expandQuantities([line({ quantity: 20 }), line({ quantity: 20 }), line({ quantity: 20 })])).toHaveLength(50);
  });
});
