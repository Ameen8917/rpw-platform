/* Approval thresholds — change these two numbers to retune the whole workflow */
export const RESIDUAL_PCT = 5;             // Schedule II residual value assumption

/* Group-wide authority rules. Editable from Admin -> Authority. */
/* Mutable on purpose: Admin → Authority edits these in place (moves to the database with the backend) */
export const LIMITS: Record<"purchaseDirector" | "advanceEscalation" | "directorPayment" | "capitalisation" | "slaDays" | "variancePct", number> = {
  purchaseDirector: 50000,   // estimate above this needs Director approval before buying
  advanceEscalation: 50000,  // advance above this also needs GM Finance + Director
  directorPayment: 10000,    // final payment below this skips Director approval
  capitalisation: 5000,      // below this a separate purchase is expensed, not capitalised
  slaDays: 3,                // approver silence beyond this escalates to the Director
  variancePct: 5,            // actual cost over estimate beyond this needs re-approval
};
