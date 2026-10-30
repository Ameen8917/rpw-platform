import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import App from "./App";
import { Login } from "./features/shell/Login";

describe("App", () => {
  it("loads the full module graph and starts by checking the session", () => {
    expect(renderToString(<App />)).toContain("Loading…");
  });

  it("renders the sign-in form", () => {
    const html = renderToString(<Login onSignedIn={() => {}} />);
    expect(html).toContain("Employee code");
    expect(html).toContain("Sign in");
  });

  it("explains an ended session", () => {
    expect(renderToString(<Login onSignedIn={() => {}} expired />)).toContain("Your session has ended");
  });
});
