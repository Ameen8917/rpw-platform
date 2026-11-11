import { z } from "zod";
import { CATEGORIES } from "../assets/asset-rules.js";
import { PAYMENT_KINDS, STAGES } from "./requisitions.models.js";

const text = (max: number) => z.string().trim().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s), "Not a real date");
const optionalDate = z.union([isoDate, z.literal("")]).nullish().transform((v) => v || null);
/* "" (an unselected <select>) and null both mean "none" */
const optionalId = text(40).nullish().transform((v) => v || null);
const money = () => z.number().max(1e11);

export const requisitionIdParams = z.object({ id: z.string().uuid("Not a requisition ID") });

/* What is asked for; shared by raising and resubmitting */
const request = {
  item: text(300).min(1, "Say what is needed"),
  qty: z.number().int("Whole units").positive("At least one").max(100000),
  estCost: money().positive("Estimate is required"),
  justification: text(2000).min(1, "Justification is required"),
  expectedDelivery: optionalDate,
};

export const raiseBody = z.object({
  dealershipId: text(40).min(1, "Dealership is required"),
  facilityId: optionalId,
  deptId: text(40).min(1, "Department is required"),
  ...request,
  advance: z.object({
    required: z.boolean(),
    amount: money().nonnegative().default(0),
    terms: text(500).default(""),
  }).strict().default({ required: false, amount: 0, terms: "" }),
}).strict().superRefine((b, ctx) => {
  if (b.advance.required && b.advance.amount <= 0) {
    ctx.addIssue({ code: "custom", path: ["advance", "amount"], message: "Enter the advance amount" });
  }
  if (b.advance.required && b.advance.amount > b.estCost) {
    ctx.addIssue({ code: "custom", path: ["advance", "amount"], message: "The advance cannot be more than the estimate" });
  }
});
export type RaiseInput = z.infer<typeof raiseBody>;

export const resubmitBody = z.object(request).strict();
export type ResubmitInput = z.infer<typeof resubmitBody>;

/* Which answers each stage takes: purchase approvals approve or reject (final); money stages
   approve or hold (and can be decided again); a cost overrun is approved or queried */
export const STAGE_DECISIONS = {
  bh: ["approved", "rejected"],
  fn: ["approved", "rejected"],
  directorPurchase: ["approved", "rejected"],
  advanceApproval: ["approved", "held"],
  advanceFinance: ["approved", "held"],
  advanceDirector: ["approved", "held"],
  varianceApproval: ["approved", "queried"],
  financeApproval: ["approved", "held"],
  directorApproval: ["approved", "held"],
} as const;

export const decisionParams = z.object({
  id: z.string().uuid("Not a requisition ID"),
  stage: z.enum(STAGES),
});

export const decisionBody = z.object({
  decision: z.enum(["approved", "rejected", "held", "queried"]),
  note: text(1000).default(""),
}).strict().superRefine((b, ctx) => {
  if (b.decision !== "approved" && !b.note) ctx.addIssue({ code: "custom", path: ["note"], message: "Give a reason" });
});
export type DecisionInput = z.infer<typeof decisionBody>;

export const paymentParams = z.object({
  id: z.string().uuid("Not a requisition ID"),
  kind: z.enum(PAYMENT_KINDS),
});

export const PAYMENT_MODES = ["NEFT", "RTGS", "Cheque", "UPI", "Cash"] as const;
export const paymentBody = z.object({
  amount: money().positive("Amount is required"),
  mode: z.enum(PAYMENT_MODES),
  ref: text(100).min(1, "Enter the UTR or cheque number"),
}).strict();
export type PaymentInput = z.infer<typeof paymentBody>;

const invoiceDoc = () => z.object({
  fileName: text(200).optional(),
  vendor: text(200).optional(),
  invoiceNo: text(100).optional(),
  invoiceDate: isoDate.optional(),
  total: z.number().nonnegative().max(1e11).optional(),
}).strict().nullish().transform((v) => v ?? null);

/* The purchase. Where it sits (dealership, location, department) comes from the requisition. */
export const procureBody = z.object({
  purchaseDate: isoDate,
  vendor: text(200).min(1, "Vendor is required"),
  invoiceNo: text(100).default(""),
  invoiceDoc: invoiceDoc(),
  /** Each line becomes one asset */
  assets: z.array(z.object({
    category: z.enum(CATEGORIES),
    name: text(200).min(1, "Name is required"),
    make: text(200).default(""),
    model: text(200).default(""),
    serial: text(200).default(""),
    cost: money().positive("Cost is required"),
    warranty: optionalDate,
    bundled: z.array(text(100).min(1)).max(20).default([]),
    assignedTo: optionalId,
  }).strict()).min(1, "At least one asset is required").max(50),
}).strict();
export type ProcureInput = z.infer<typeof procureBody>;

export const verifyBody = z.object({
  decision: z.enum(["verified", "sent_back"]),
  note: text(1000).default(""),
}).strict().superRefine((b, ctx) => {
  if (b.decision === "sent_back" && !b.note) ctx.addIssue({ code: "custom", path: ["note"], message: "Say what needs correcting" });
});
export type VerifyInput = z.infer<typeof verifyBody>;
