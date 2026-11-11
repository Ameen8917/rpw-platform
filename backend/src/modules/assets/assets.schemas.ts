import { z } from "zod";
import { ASSET_SOURCES, ASSET_STATUSES, CATEGORIES } from "./asset-rules.js";

const text = (max: number) => z.string().trim().max(max);
/* Optional reference: "" (an unselected <select>) and null both mean "none" */
const optionalId = text(40).nullish().transform((v) => v || null);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s), "Not a real date");
const optionalDate = z.union([isoDate, z.literal("")]).nullish().transform((v) => v || null);

export const listAssetsQuery = z.object({
  q: text(100).optional(),
  dealershipId: text(40).optional(),
  source: z.enum(ASSET_SOURCES).optional(),
  status: z.enum(ASSET_STATUSES).optional(),
}).strict();

export const assetIdParams = z.object({ id: z.string().uuid("Not an asset ID") });

/* A full code (RPW/JNS/IT/26-27/0007 or legacy RPW-IT-0142) or the numeric tag ID */
export const lookupQuery = z.object({ code: text(100).min(1, "Enter a code or tag ID") }).strict();

const invoiceDoc = () => z.object({
  fileName: text(200).optional(),
  vendor: text(200).optional(),
  invoiceNo: text(100).optional(),
  invoiceDate: isoDate.optional(),
  total: z.number().nonnegative().max(1e11).optional(),
}).strict().nullish().transform((v) => v ?? null);

const money = () => z.number().max(1e11);

export const createAssetBody = z.object({
  category: z.enum(CATEGORIES),
  name: text(200).min(1, "Name is required"),
  make: text(200).default(""),
  model: text(200).default(""),
  serial: text(200).default(""),
  purchaseDate: optionalDate,
  cost: z.number().positive("Cost is required").max(1e11),
  vendor: text(200).default(""),
  dealershipId: text(40).min(1, "Dealership is required"),
  facilityId: optionalId,
  deptId: optionalId,
  warranty: optionalDate,
  /** Items issued with the asset that are not assets themselves */
  bundled: z.array(text(100).min(1)).max(20).default([]),
  assignedTo: optionalId,
  /** Details read from (or typed off) the invoice. Attaching the file itself is not built yet. */
  invoiceDoc: invoiceDoc(),
}).strict();

export type CreateAssetInput = z.infer<typeof createAssetBody>;

/* Bundled items are inside the asset cost. Separately bought ones are expensed, so they must be
   below the capitalisation floor; anything dearer is registered as an asset of its own. */
export const accessoryBody = z.object({
  name: text(100).min(1, "Name is required"),
  origin: z.enum(["bundled", "separate"]),
  serial: text(100).transform((v) => v || "—").default("—"),
  cost: money().nonnegative().default(0),
  addedAt: optionalDate,
}).strict().superRefine((x, ctx) => {
  if (x.origin === "bundled" && x.cost !== 0) {
    ctx.addIssue({ code: "custom", path: ["cost"], message: "Bundled items have no separate cost" });
  }
  if (x.origin === "separate" && x.cost <= 0) {
    ctx.addIssue({ code: "custom", path: ["cost"], message: "Cost is required for an item bought separately" });
  }
  /* The capitalisation floor is a group setting, checked by the service */
});

export type AccessoryInput = z.infer<typeof accessoryBody>;

export const disposeBody = z.object({
  reason: text(500).min(1, "Reason is required"),
  scrapValue: money().nonnegative().nullish().transform((v) => v ?? null),
}).strict();

export type DisposeInput = z.infer<typeof disposeBody>;
