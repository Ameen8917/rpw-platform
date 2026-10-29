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
          onDispose={noop} onAddAccessory={noop} onIssue={noop} onReturn={noop} onAccept={noop} />,
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
