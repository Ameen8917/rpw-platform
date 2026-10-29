import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import App from "./App";

describe("App", () => {
  it("loads the full module graph and renders the sign-in screen", () => {
    expect(renderToString(<App />)).toContain("Sign in");
  });
});
