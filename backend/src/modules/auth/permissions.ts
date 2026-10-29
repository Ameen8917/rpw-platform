import type { UserDto } from "../org/org.dto.js";

/* Server-side port of the prototype's P(user) (frontend/src/domain/permissions.ts), same keys,
   so the frontend can use this object as-is. Powers the prototype tied to specific user IDs
   (GM Finance, IT Head, Admin Manager) now come from the user's grants. */
export function permissionsFor(user: Pick<UserDto, "role" | "deptId" | "grants">) {
  const r = user.role;
  const has = (g: UserDto["grants"][number]) => user.grants.includes(g);
  const isAccounts = user.deptId === "DEP_ACC";
  /* Only dealership accounts managers release advances; GM Finance signs off final payments */
  const isDealershipAccounts = isAccounts && r === "manager";
  const isExecutive = r === "accounts_executive";
  return {
    isAccounts,
    isDealershipAccounts,
    isExecutive,
    isGMFinance: has("finance_signoff"),
    canSeePayments: r === "director" || isAccounts || isExecutive,
    canApproveAdvance: isDealershipAccounts,
    canExecutePayment: isExecutive,
    canFinanceSignoff: has("finance_signoff"),
    isDirector: r === "director",
    isFnHead: r === "functional_head",
    isBH: r === "business_head",
    isManager: r === "manager",
    canRaise: r === "manager" || r === "functional_head",
    canSeeAllReqs: r === "director",
    canProcure: r === "functional_head" || r === "manager",
    canVerifyEntry: r === "functional_head",
    canAdminConsole: r === "director" || has("admin_console"),
    canSeeCost: true,
    canAddExisting: r === "functional_head" || r === "director",
    canDispose: r === "director" || has("dispose_assets"),
    canSeeAudit: r === "director" || r === "functional_head",
    canSeeProcurement: r === "director" || r === "functional_head" || r === "business_head",
  };
}

export type Permissions = ReturnType<typeof permissionsFor>;
