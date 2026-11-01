import { describe, expect, it } from "vitest";
import { parseRoute, routeHash } from "./route";

describe("hash routes", () => {
  it("defaults to the dashboard", () => {
    expect(parseRoute("")).toEqual({ view: "dashboard", id: null });
    expect(parseRoute("#/")).toEqual({ view: "dashboard", id: null });
  });

  it("reads a view and an optional id", () => {
    expect(parseRoute("#/assets")).toEqual({ view: "assets", id: null });
    expect(parseRoute("#/assetdetail/6f1c2a")).toEqual({ view: "assetdetail", id: "6f1c2a" });
  });

  it("round-trips ids that need escaping", () => {
    const route = { view: "reqdetail", id: "REQ/2026 0027" };
    expect(parseRoute(routeHash(route))).toEqual(route);
  });
});
