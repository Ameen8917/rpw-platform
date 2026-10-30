import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../app.js";
import type { AssetService } from "../assets/assets.service.js";
import type { CustodyService } from "../assets/custody.service.js";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthContext, AuthService } from "../auth/auth.service.js";
import { permissionsFor } from "../auth/permissions.js";
import type { OrgService } from "../org/org.service.js";
import type { InvoiceReader } from "./invoice-reader.js";
import { extractedInvoice, INVOICE_LIMITS, sniffInvoiceType } from "./invoices.schemas.js";
import { createInvoiceService } from "./invoices.service.js";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const PDF = Buffer.from("%PDF-1.7\n...");
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);

const person = (id: string, role: string): AuthContext => {
  const user = { id, name: id, role, deptId: null, grants: [] } as unknown as AuthContext["user"];
  return { user, permissions: permissionsFor(user) };
};
/* The session cookie names the person directly; no database */
const people: Record<string, AuthContext> = {
  head: person("U_HEAD", "functional_head"),
  mgr: person("U_MGR", "manager"),
  staff: person("U_STAFF", "staff"),
};

const sample = {
  vendor: " Ingram Micro ", invoiceNo: "INV-8841", invoiceDate: "2026-08-12", total: 63900, subtotal: 54153, tax: 9747,
  items: [{ name: "Network Switch 24-Port", make: "Cisco", model: "CBS250", serial: null, category: "IT Equipment",
    unitCost: 41500, quantity: 1, warrantyMonths: 36, bundled: ["Rack kit"] }],
};

function appWith(reader: InvoiceReader | null, hourlyLimit = 30) {
  return createApp({
    corsOrigin: "http://localhost:5173", checkDatabase: async () => {},
    auth: { resolve: async (token: string) => people[token] ?? null } as unknown as AuthService,
    org: {} as OrgService, assets: {} as AssetService, custody: {} as CustodyService, audit: {} as AuditService,
    invoices: createInvoiceService({ reader, hourlyLimit }),
    cookie: { secure: false }, devLoginEnabled: false,
  });
}
const fakeReader = (output: unknown = sample) => {
  const read = vi.fn(async () => ({ output, inputTokens: 1500, outputTokens: 300 }));
  return { reader: { read } as InvoiceReader, read };
};
const extract = (app: ReturnType<typeof createApp>, who: string, file: Buffer, type = "image/png") =>
  request(app).post("/api/invoices/extract").set("Cookie", `rpw_session=${who}`).set("Content-Type", type).send(file);

describe("sniffInvoiceType", () => {
  it("knows the file by its first bytes", () => {
    expect(sniffInvoiceType(PNG)).toBe("image/png");
    expect(sniffInvoiceType(PDF)).toBe("application/pdf");
    expect(sniffInvoiceType(JPEG)).toBe("image/jpeg");
    expect(sniffInvoiceType(WEBP)).toBe("image/webp");
    expect(sniffInvoiceType(Buffer.from("GIF89a"))).toBe("image/gif");
    expect(sniffInvoiceType(Buffer.from("<html>"))).toBeNull();
    expect(sniffInvoiceType(Buffer.from("RIFF0000WAVE"))).toBeNull();
  });
});

describe("extractedInvoice (checks the model's answer)", () => {
  it("keeps good values and trims text", () => {
    const out = extractedInvoice.parse(sample);
    expect(out.vendor).toBe("Ingram Micro");
    expect(out.items[0]).toMatchObject({ name: "Network Switch 24-Port", category: "IT Equipment", unitCost: 41500, bundled: ["Rack kit"] });
  });

  it("turns bad fields into null field by field and drops nameless lines", () => {
    const out = extractedInvoice.parse({
      vendor: "", invoiceNo: 42, invoiceDate: "2026-02-30", total: -5, subtotal: "100", tax: null,
      items: [
        { ...sample.items[0], category: "Spaceship", quantity: 1.5, warrantyMonths: 9999, bundled: ["Cable", 7, " "] },
        { ...sample.items[0], name: "  " },
        "not an item",
      ],
    });
    expect(out).toMatchObject({ vendor: null, invoiceNo: null, invoiceDate: null, total: null, subtotal: null, tax: null });
    expect(out.items).toHaveLength(1);
    expect(out.items[0]).toMatchObject({ category: null, quantity: null, warrantyMonths: null, bundled: ["Cable"] });
  });

  it("fails only when the answer is not an object", () => {
    expect(extractedInvoice.safeParse("text").success).toBe(false);
    expect(extractedInvoice.parse({}).items).toEqual([]);
  });
});

describe("GET /api/invoices/status", () => {
  it("says AI reading is on only with a reader and for people who record assets", async () => {
    const on = appWith(fakeReader().reader);
    expect((await request(on).get("/api/invoices/status").set("Cookie", "rpw_session=head")).body)
      .toEqual({ aiReading: true, maxImageBytes: INVOICE_LIMITS.imageBytes, maxPdfBytes: INVOICE_LIMITS.pdfBytes });
    expect((await request(on).get("/api/invoices/status").set("Cookie", "rpw_session=staff")).body.aiReading).toBe(false);
    expect((await request(appWith(null)).get("/api/invoices/status").set("Cookie", "rpw_session=head")).body.aiReading).toBe(false);
  });
});

describe("POST /api/invoices/extract", () => {
  it("reads an image and returns the checked invoice", async () => {
    const { reader, read } = fakeReader();
    const res = await extract(appWith(reader), "mgr", PNG);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ vendor: "Ingram Micro", total: 63900, items: [{ model: "CBS250" }] });
    expect(read).toHaveBeenCalledWith(PNG, "image/png");
  });

  it("goes by the bytes, not the claimed type", async () => {
    const { reader, read } = fakeReader();
    expect((await extract(appWith(reader), "head", PDF, "image/jpeg")).status).toBe(200);
    expect(read).toHaveBeenCalledWith(expect.any(Buffer), "application/pdf");
  });

  it("refuses other files, empty bodies and JSON", async () => {
    const { reader, read } = fakeReader();
    const app = appWith(reader);
    const bad = await extract(app, "head", Buffer.from("MZ executable"), "application/pdf");
    expect(bad.status).toBe(400);
    expect(bad.body.error.details[0]).toMatchObject({ path: "file" });
    expect((await extract(app, "head", Buffer.alloc(0))).status).toBe(400);
    expect((await request(app).post("/api/invoices/extract").set("Cookie", "rpw_session=head").send({ file: "x" })).status).toBe(400);
    expect(read).not.toHaveBeenCalled();
  });

  it("refuses images over the image limit", async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(INVOICE_LIMITS.imageBytes)]);
    const res = await extract(appWith(fakeReader().reader), "head", big);
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].message).toMatch(/too large/);
  });

  it("is 403 for people who do not record assets", async () => {
    expect((await extract(appWith(fakeReader().reader), "staff", PNG)).status).toBe(403);
  });

  it("is 503 when AI reading is not set up", async () => {
    const res = await extract(appWith(null), "head", PNG);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("invoice_reading_off");
  });

  it("limits readings per person per hour", async () => {
    const app = appWith(fakeReader().reader, 2);
    expect((await extract(app, "head", PNG)).status).toBe(200);
    expect((await extract(app, "head", PNG)).status).toBe(200);
    const third = await extract(app, "head", PNG);
    expect(third.status).toBe(429);
    expect(Number(third.headers["retry-after"])).toBeGreaterThan(0);
    expect((await extract(app, "mgr", PNG)).status).toBe(200);
  });

  it("is 422 when the answer is not an invoice", async () => {
    const res = await extract(appWith(fakeReader("no").reader), "head", PNG);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("invoice_unreadable");
  });
});
