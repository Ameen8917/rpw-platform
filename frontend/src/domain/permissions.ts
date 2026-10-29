import type { User } from "../types";

/* The workflow matrix: every power in the platform, and who holds it.
   Each row is derived from the person's role, so changing a role changes their authority. */
export const CAPABILITIES = [
  { key: "raise", label: "Raise requisition", short: "Raise",
    has: (u) => u.role === "manager" || u.role === "functional_head" },
  { key: "bh", label: "Approve as Business Head", short: "BH approve",
    has: (u) => u.role === "business_head" || u.role === "director" },
  { key: "fn", label: "Approve as functional head", short: "Functional",
    has: (u) => u.role === "functional_head" },
  { key: "dir", label: "Director approval (purchase & payment)", short: "Director",
    has: (u) => u.role === "director" },
  { key: "procure", label: "Record procurement", short: "Procure",
    has: (u) => u.role === "functional_head" },
  { key: "advance", label: "Approve vendor advance", short: "Advance",
    has: (u) => u.role === "manager" && u.deptId === "DEP_ACC" },
  { key: "signoff", label: "Payment sign-off", short: "Sign-off",
    has: (u) => u.id === "U_SUJAY" },
  { key: "pay", label: "Execute payment & enter UTR", short: "Pay",
    has: (u) => u.role === "accounts_executive" },
  { key: "assets", label: "Add & issue assets", short: "Assets",
    has: (u) => u.role === "functional_head" || u.role === "director" },
  { key: "admin", label: "Admin console", short: "Admin",
    has: (u) => u.role === "director" || u.id === "U_SUNIL" || u.id === "U_PARESH" },
];

export const ROLE_OPTIONS = [
  { value: "director", label: "Director", note: "Full authority across the group" },
  { value: "business_head", label: "Business Head", note: "Approves everything at their dealership" },
  { value: "functional_head", label: "Corporate functional head", note: "Second signature for their function, everywhere" },
  { value: "manager", label: "Dealership manager", note: "Raises requisitions for their department" },
  { value: "accounts_executive", label: "Accounts executive", note: "Executes payments, approves nothing" },
  { value: "staff", label: "Staff — no login", note: "Can hold assets, no platform access" },
];

export type Permissions = ReturnType<typeof P>;
export function P(user: User) {
  const r = user.role;
  const isAccounts = user.deptId === "DEP_ACC";
  /* Only dealership accounts managers release advances. Sujay (GM Finance) does not —
     his single action is the third-signature sign-off on final payment. */
  const isDealershipAccounts = isAccounts && r === "manager";
  const isExecutive = r === "accounts_executive";
  return {
    isAccounts,
    isDealershipAccounts,
    isExecutive,
    isGMFinance: user.id === "U_SUJAY",
    canSeePayments: r === "director" || isAccounts || isExecutive,
    canApproveAdvance: isDealershipAccounts,
    canExecutePayment: isExecutive,
    canFinanceSignoff: user.id === "U_SUJAY",
    isDirector: r === "director",
    isFnHead: r === "functional_head",
    isBH: r === "business_head",
    isManager: r === "manager",
    canRaise: r === "manager" || r === "functional_head",
    canSeeAllReqs: r === "director",
    canProcure: r === "functional_head" || r === "manager",
    canVerifyEntry: r === "functional_head",
    canAdminConsole: r === "director" || user.id === "U_SUNIL" || user.id === "U_PARESH",
    canSeeCost: true,
    canAddExisting: r === "functional_head" || r === "director",
    canDispose: r === "director" || user.id === "U_SUJAY",
    canSeeAudit: r === "director" || r === "functional_head",
    canSeeProcurement: r === "director" || r === "functional_head" || r === "business_head",
  };
}
