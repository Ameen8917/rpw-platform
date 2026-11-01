import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { SEED_ASSETS, SEED_AUDIT, SEED_DEALERSHIPS, SEED_DEPARTMENTS, SEED_FACILITIES, SEED_REQS, SEED_USERS } from "../../data/seed";
import { P } from "../../domain/permissions";
import { AssetDetail } from "./AssetDetail";
import { AssetList } from "./AssetList";
import { CustodyView } from "./CustodyView";
import { NewExistingAsset } from "./NewExistingAsset";
import { ScanView } from "./ScanView";

/* Mirrors the ctx App builds, for a given signed-in user */
function ctxFor(userId: string) {
  const user = SEED_USERS.find((u) => u.id === userId)!;
  return {
    user, perm: P(user), users: SEED_USERS, dealerships: SEED_DEALERSHIPS, facilities: SEED_FACILITIES,
    departments: SEED_DEPARTMENTS, assets: SEED_ASSETS,
    U: (id: string) => SEED_USERS.find((u) => u.id === id),
    D: (id: string) => SEED_DEALERSHIPS.find((d) => d.id === id),
    F: (id: string) => SEED_FACILITIES.find((f) => f.id === id),
    DEP: (id: string) => SEED_DEPARTMENTS.find((d) => d.id === id),
    go: () => {},
  };
}
const noop = () => {};

describe("asset screens render with seed data", () => {
  const director = ctxFor("U_ARJ");

  it("asset register", () => {
    const html = renderToString(<AssetList ctx={director} assets={SEED_ASSETS} />);
    expect(html).toContain("Asset register");
    expect(html).toContain("Reception Laptop");
  });

  it("detail of every asset, including issued ones (regression: `user` was undefined)", () => {
    for (const a of SEED_ASSETS) {
      const html = renderToString(
        <AssetDetail ctx={director} a={a} reqs={SEED_REQS} auditLog={SEED_AUDIT}
          onDispose={noop} onAddAccessory={noop} onIssue={noop} onReturn={noop} onAccept={noop} onAttach={noop} onRemoveAttachment={noop} />,
      );
      expect(html).toContain(a.code);
    }
  });

  it("custody register and scan view", () => {
    expect(renderToString(<CustodyView ctx={director} assets={SEED_ASSETS} />)).toContain("Asset custody");
    expect(renderToString(<ScanView ctx={director} assets={SEED_ASSETS} />)).toContain("Scan asset");
  });

  it("add existing asset form", () => {
    const html = renderToString(<NewExistingAsset ctx={ctxFor("U_SUNIL")} onCancel={noop} onCreate={noop} />);
    expect(html).toContain("RPW/MCH/IT/");
  });
});

describe("asset detail with server data", () => {
  const base = SEED_ASSETS.find((a) => a.code === "RPW-IT-0142")!;

  it("shows a write-off, the server's book value and saved activity", () => {
    const a = {
      ...base, status: "disposed" as const, assignedTo: null, acceptance: null,
      disposal: { reason: "Beyond repair", scrapValue: 1500, bookValue: 4321.4, by: "U_SUJAY", at: "2026-10-30T06:00:00.000Z" },
      depreciation: { life: 3, rate: 63.2, years: 2, residual: 3100, nbv: 4321.4, accumulated: 57678.6, fullyDepreciated: false },
      activity: [{ id: "e1", at: "2026-10-30T06:00:00.000Z", actorId: "U_SUJAY", action: "Disposed asset", ref: base.code, detail: "Beyond repair · scrap ₹1,500" }],
    };
    const html = renderToString(<AssetDetail ctx={ctxFor("U_SUJAY")} a={a} reqs={SEED_REQS} auditLog={[]}
      onDispose={noop} onAddAccessory={noop} onIssue={noop} onReturn={noop} onAccept={noop} onAttach={noop} onRemoveAttachment={noop} />);
    expect(html).toContain("Written off on");
    expect(html).toContain("Book value ₹4,321");
    expect(html).toContain("Disposed asset");
    expect(html).not.toContain("Add accessory");
  });

  it("asks for the return before an issued asset can be written off", () => {
    const issued = SEED_ASSETS.find((a) => a.assignedTo)!;
    const html = renderToString(<AssetDetail ctx={ctxFor("U_ARJ")} a={issued} reqs={SEED_REQS} auditLog={[]}
      onDispose={noop} onAddAccessory={noop} onIssue={noop} onReturn={noop} onAccept={noop} onAttach={noop} onRemoveAttachment={noop} />);
    expect(html).toContain("record its return first");
  });

  it("lists attachments and the invoice details; only those who add assets may change them", () => {
    const a = {
      ...base,
      invoiceDoc: { vendor: "Dell India", invoiceNo: "DI/2024/118", invoiceDate: "2024-07-15", total: 62000 },
      attachments: [
        { id: "x1", kind: "invoice" as const, fileName: "dell-invoice.pdf", contentType: "application/pdf", sizeBytes: 250 * 1024,
          caption: "", addedBy: "U_SUNIL", addedAt: "2026-11-01T06:00:00.000Z", url: "https://storage.example/x1" },
        { id: "x2", kind: "photo" as const, fileName: "front.jpg", contentType: "image/jpeg", sizeBytes: 900 * 1024,
          caption: "Serial plate", addedBy: "U_SUNIL", addedAt: "2026-11-01T06:05:00.000Z", url: null },
      ],
    };
    /* Without React's <!-- --> markers between adjacent text pieces */
    const render = (userId: string) => renderToString(<AssetDetail ctx={ctxFor(userId)} a={a} reqs={SEED_REQS} auditLog={[]}
      onDispose={noop} onAddAccessory={noop} onIssue={noop} onReturn={noop} onAccept={noop} onAttach={noop} onRemoveAttachment={noop} />)
      .replace(/<!-- -->/g, "");

    const head = render("U_SUNIL");
    expect(head).toContain("Attachments (2)");
    expect(head).toContain("Dell India · No. DI/2024/118");
    expect(head).toContain("dell-invoice.pdf");
    expect(head).toContain("Serial plate");
    expect(head).toContain("link unavailable");
    expect(head).toContain("Add photo / document");
    expect(head).toContain("Remove front.jpg");

    const manager = render("U_ANI");
    expect(manager).toContain("dell-invoice.pdf");
    expect(manager).not.toContain("Add photo / document");
    expect(manager).not.toContain("Remove front.jpg");
  });
});
