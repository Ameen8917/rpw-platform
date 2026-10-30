import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../../lib/http-error.js";
import { createClaudeInvoiceReader } from "./invoice-reader.js";

/* The SDK's HTTP calls go to a stub: checks what is sent and how answers map, with no API key */
const message = (over: Record<string, unknown> = {}) => ({
  id: "msg_1", type: "message", role: "assistant", model: "claude-haiku-5-5", stop_reason: "end_turn", stop_sequence: null,
  content: [{ type: "text", text: JSON.stringify({ vendor: "Croma", items: [] }) }],
  usage: { input_tokens: 1200, output_tokens: 80 }, ...over,
});
function stub(status: number, body: unknown) {
  const calls: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}
const reader = (s: ReturnType<typeof stub>) => createClaudeInvoiceReader({ apiKey: "test-key", model: "claude-haiku-5-5", fetch: s.fetch });
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe("createClaudeInvoiceReader", () => {
  it("sends the image with the JSON schema format and returns the parsed answer", async () => {
    const s = stub(200, message());
    const out = await reader(s).read(PNG, "image/png");
    expect(out).toEqual({ output: { vendor: "Croma", items: [] }, inputTokens: 1200, outputTokens: 80 });

    const { url, headers, body } = s.calls[0];
    expect(url).toMatch(/\/v1\/messages$/);
    expect(headers.get("x-api-key") ?? headers.get("authorization")).toContain("test-key");
    expect(body.model).toBe("claude-haiku-5-5");
    expect(body.output_config).toMatchObject({ effort: "medium", format: { type: "json_schema", schema: { type: "object" } } });
    const content = (body.messages as { content: { type: string; source?: { media_type: string; data: string } }[] }[])[0].content;
    expect(content[0]).toEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: PNG.toString("base64") } });
    expect(content[1].type).toBe("text");
  });

  it("sends a PDF as a document block", async () => {
    const s = stub(200, message());
    await reader(s).read(Buffer.from("%PDF-1.7"), "application/pdf");
    const content = (s.calls[0].body.messages as { content: { type: string; source: { media_type: string } }[] }[])[0].content;
    expect(content[0]).toMatchObject({ type: "document", source: { media_type: "application/pdf" } });
  });

  const failsWith = async (s: ReturnType<typeof stub>, status: number, code: string) => {
    const err = await reader(s).read(PNG, "image/png").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({ status, code });
  };

  it("maps a refusal, a cut-off answer and non-JSON to 422", async () => {
    await failsWith(stub(200, message({ stop_reason: "refusal", content: [] })), 422, "invoice_unreadable");
    await failsWith(stub(200, message({ stop_reason: "max_tokens" })), 422, "invoice_unreadable");
    await failsWith(stub(200, message({ content: [{ type: "text", text: "Sorry" }] })), 422, "invoice_unreadable");
  });

  it("maps a rejected file to 422 and a bad key to 503 without leaking it", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await failsWith(stub(400, { type: "error", error: { type: "invalid_request_error", message: "image too large" } }), 422, "invoice_unreadable");
    await failsWith(stub(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }), 503, "invoice_reading_unavailable");
    expect(errSpy.mock.calls.flat().join(" ")).not.toContain("test-key");
    vi.restoreAllMocks();
  });
});
