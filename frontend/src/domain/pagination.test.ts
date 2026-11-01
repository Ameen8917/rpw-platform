import { describe, expect, it } from "vitest";
import { pageNumbers, pageWindow } from "./pagination";

describe("pageWindow", () => {
  it("places a page within the list", () => {
    expect(pageWindow(312, 2, 25)).toEqual({ page: 2, pages: 13, offset: 25, from: 26, to: 50 });
    expect(pageWindow(312, 13, 25)).toMatchObject({ from: 301, to: 312 });
  });

  it("clamps pages out of range, e.g. after a filter shrinks the list", () => {
    expect(pageWindow(30, 9, 25)).toMatchObject({ page: 2, from: 26, to: 30 });
    expect(pageWindow(30, 0, 25)).toMatchObject({ page: 1, from: 1 });
  });

  it("handles an empty list as one empty page", () => {
    expect(pageWindow(0, 3, 25)).toEqual({ page: 1, pages: 1, offset: 0, from: 0, to: 0 });
  });
});

describe("pageNumbers", () => {
  it("lists every page when there are few", () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps the ends and the pages around the current one", () => {
    expect(pageNumbers(1, 20)).toEqual([1, 2, 3, "…", 20]);
    expect(pageNumbers(10, 20)).toEqual([1, "…", 8, 9, 10, 11, 12, "…", 20]);
    expect(pageNumbers(20, 20)).toEqual([1, "…", 18, 19, 20]);
  });

  it("shows a single hidden page as its number rather than …", () => {
    expect(pageNumbers(5, 20)).toEqual([1, 2, 3, 4, 5, 6, 7, "…", 20]);
  });
});
