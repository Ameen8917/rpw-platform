import { describe, expect, it } from "vitest";
import { ATTACHMENT_MAX_BYTES, attachmentName, attachmentProblem, fileSize } from "./attachments";

describe("attachment checks (same rules as the server)", () => {
  it("accepts images and PDFs within the limit", () => {
    expect(attachmentProblem("photo", "image/jpeg", 1000)).toBeNull();
    expect(attachmentProblem("invoice", "application/pdf", ATTACHMENT_MAX_BYTES)).toBeNull();
    expect(attachmentProblem("document", "image/webp", 10)).toBeNull();
  });

  it("explains what cannot be attached", () => {
    expect(attachmentProblem("document", "text/plain", 10)).toMatch(/Only JPEG, PNG, WebP/);
    expect(attachmentProblem("photo", "application/pdf", 10)).toMatch(/must be an image/);
    expect(attachmentProblem("invoice", "application/pdf", ATTACHMENT_MAX_BYTES + 1)).toMatch(/larger than 4 MB/);
  });

  it("names a converted photo after the original, as JPEG", () => {
    const file = new File(["x"], "IMG_0042.HEIC", { type: "image/heic" });
    expect(attachmentName(file, file)).toBe("IMG_0042.HEIC");
    expect(attachmentName(file, new Blob(["y"], { type: "image/jpeg" }))).toBe("IMG_0042.jpg");
  });

  it("shows sizes people can read", () => {
    expect(fileSize(300)).toBe("1 KB");
    expect(fileSize(250 * 1024)).toBe("250 KB");
    expect(fileSize(3.4 * 1024 * 1024)).toBe("3.4 MB");
  });
});
