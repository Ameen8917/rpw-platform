import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, errorMessage, setUnauthorizedHandler } from "./api";

const reply = (status: number, body?: unknown) =>
  vi.fn().mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

afterEach(() => { vi.unstubAllGlobals(); setUnauthorizedHandler(null); });

describe("api client", () => {
  it("sends JSON to /api on the same origin and returns the body", async () => {
    const fetch = reply(201, { id: "a1" });
    vi.stubGlobal("fetch", fetch);
    expect(await api.post("/assets", { name: "Laptop" })).toEqual({ id: "a1" });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/assets");
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin", body: JSON.stringify({ name: "Laptop" }) });
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("turns the error shape into an ApiError with field details", async () => {
    vi.stubGlobal("fetch", reply(400, { error: { code: "validation_error", message: "Request is invalid", details: [{ location: "body", path: "cost", message: "Cost is required" }] } }));
    const err = await api.post("/assets", {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: "validation_error" });
    expect(errorMessage(err)).toBe("Cost is required (cost)");
  });

  it("reports a lost session, except from the sign-in calls themselves", async () => {
    const ended = vi.fn();
    setUnauthorizedHandler(ended);
    vi.stubGlobal("fetch", reply(401, { error: { code: "unauthorized", message: "Sign in required" } }));
    await api.get("/auth/me").catch(() => {});
    expect(ended).not.toHaveBeenCalled();
    await api.get("/assets").catch(() => {});
    expect(ended).toHaveBeenCalledOnce();
  });

  it("explains an unreachable server and non-JSON failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(errorMessage(await api.get("/assets").catch((e) => e))).toMatch(/Cannot reach the server/);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 })));
    expect(await api.get("/assets").catch((e) => e)).toMatchObject({ status: 502, code: "http_error" });
  });
});
