import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createApp } from "./app.js";
import { errorHandler } from "./middleware/error-handler.js";
import { validate } from "./middleware/validate.js";

const appWith = (checkDatabase: () => Promise<unknown>) =>
  createApp({ corsOrigin: "http://localhost:5173", checkDatabase });

describe("GET /api/health", () => {
  it("is 200 when the database answers", async () => {
    const res = await request(appWith(async () => {})).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", database: "ok" });
  });

  it("is 503 without leaking the error when the database is down", async () => {
    const res = await request(appWith(async () => { throw new Error("password authentication failed"); })).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "degraded", database: "unreachable" });
  });
});

describe("error handling", () => {
  const app = appWith(async () => {});

  it("returns the JSON error shape for unknown routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: "not_found" });
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await request(app).post("/api/health").set("Content-Type", "application/json").send("{bad");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_json");
  });

  it("allows the frontend origin via CORS and sets security headers", async () => {
    const res = await request(app).get("/api/health").set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("hides internals of unexpected errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const boom = express();
    boom.get("/x", () => { throw new Error("db password is hunter2"); });
    boom.use(errorHandler);
    const res = await request(boom).get("/x");
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("hunter2");
    spy.mockRestore();
  });
});

describe("validate middleware", () => {
  const app = express();
  app.use(express.json());
  app.post("/items/:id",
    validate({
      params: z.object({ id: z.string().uuid() }),
      query: z.object({ limit: z.coerce.number().int().max(100).default(20) }),
      body: z.object({ name: z.string().min(1) }),
    }),
    (_req, res) => { res.json(res.locals.validated); });
  app.use(errorHandler);

  it("passes parsed values with defaults and coercion applied", async () => {
    const id = "9b2f8f1e-3c1d-4a8e-9f2b-1a2b3c4d5e6f";
    const res = await request(app).post(`/items/${id}?limit=5`).send({ name: "Laptop" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ params: { id }, query: { limit: 5 }, body: { name: "Laptop" } });
  });

  it("reports every invalid part with its location", async () => {
    const res = await request(app).post("/items/not-a-uuid?limit=500").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
    expect(res.body.error.details.map((d: { location: string }) => d.location).sort()).toEqual(["body", "params", "query"]);
  });
});
