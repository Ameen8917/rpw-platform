import { describe, expect, it } from "vitest";
import { PALETTES, T } from "../../theme";
import { resolveTheme } from "./themePreference";

describe("theme", () => {
  it("resolves a fixed choice regardless of the device", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the device when set to system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("gives every palette the same tokens, and T a variable for each", () => {
    const keys = Object.keys(PALETTES.light).sort();
    expect(Object.keys(PALETTES.dark).sort()).toEqual(keys);
    expect(Object.keys(T).sort()).toEqual(keys);
    expect(T.lineStrong).toBe("var(--c-line-strong)");
  });
});
