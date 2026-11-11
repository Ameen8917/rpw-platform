import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { SEED_ASSETS, SEED_DEALERSHIPS, SEED_DEPARTMENTS, SEED_FACILITIES, SEED_REQS, SEED_USERS } from "../../data/seed";
import { P } from "../../domain/permissions";
import { Dashboard } from "./Dashboard";

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

describe("dashboard renders with seed data", () => {
  it("shows the charts and their controls", () => {
    const html = renderToString(<Dashboard ctx={ctxFor("U_ARJ")} reqs={SEED_REQS} assets={SEED_ASSETS} />);
    for (const text of ["Approvals waiting, by stage", "Payments in progress", "Asset custody",
      "Procurement spend by month", "Spend by dealership", "Largest purchases"]) {
      expect(html).toContain(text);
    }
    expect(html).toContain('aria-label="Period"');
  });

  it("hides payments from people who cannot see them", () => {
    const manager = SEED_USERS.find((u) => u.role === "manager" && u.deptId !== "DEP_ACC")!;
    const html = renderToString(<Dashboard ctx={ctxFor(manager.id)} reqs={SEED_REQS} assets={SEED_ASSETS} />);
    expect(html).not.toContain("Payments in progress");
    expect(html).toContain("Approvals waiting, by stage");
  });

  it("renders with nothing to show", () => {
    const html = renderToString(<Dashboard ctx={ctxFor("U_ARJ")} reqs={[]} assets={[]} />);
    expect(html).toContain("No purchases in this period.");
  });
});
