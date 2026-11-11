import { z } from "zod";

/* Group-wide authority rules (frontend/src/domain/config.ts LIMITS) */
export const LIMIT_DEFAULTS = {
  purchaseDirector: 50000,   // estimate above this needs Director approval before buying
  advanceEscalation: 50000,  // advance above this also needs GM Finance + Director
  directorPayment: 10000,    // final payment below this skips Director approval
  capitalisation: 5000,      // below this a separate purchase is expensed, not capitalised
  slaDays: 3,                // approver silence beyond this escalates to the Director
  variancePct: 5,            // actual cost over estimate beyond this needs re-approval
};

export type Limits = typeof LIMIT_DEFAULTS;
export const LIMIT_KEYS = Object.keys(LIMIT_DEFAULTS) as (keyof Limits)[];

const amount = () => z.number().nonnegative().max(1e11);

export const settingsBody = z.object({
  purchaseDirector: amount(),
  advanceEscalation: amount(),
  directorPayment: amount(),
  capitalisation: amount(),
  slaDays: z.number().int("Whole days").min(1).max(60),
  variancePct: z.number().min(0).max(100),
}).strict();

export type SettingsInput = z.infer<typeof settingsBody>;
