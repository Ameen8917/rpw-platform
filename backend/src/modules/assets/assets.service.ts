import { UniqueConstraintError, type CreationAttributes, type Transaction } from "sequelize";
import { HttpError } from "../../lib/http-error.js";
import { auditRepository, type AuditRepository } from "../audit/audit.repository.js";
import { toAuditEntryDto } from "../audit/audit.dto.js";
import type { AuthContext } from "../auth/auth.service.js";
import type { FilesService } from "../files/files.service.js";
import { orgRepository, type OrgRepository } from "../org/org.repository.js";
import { assetCode, assetCodePrefix, assetScope, depreciation, inrFull, inScope, todayIST, type AssetSource, type AssetStatus } from "./asset-rules.js";
import { signaturePaths, toAssetDto, toAttachmentDto, toCustodyEventDto, type AssetDetailDto } from "./assets.dto.js";
import type { Asset } from "./assets.models.js";
import { assetRepository, type AssetRepository } from "./assets.repository.js";
import type { AccessoryInput, CreateAssetInput, DisposeInput, ProcuredInput } from "./assets.schemas.js";

export interface AssetServiceOptions {
  assetRepo?: AssetRepository;
  orgRepo?: OrgRepository;
  auditRepo?: AuditRepository;
  /** Signs signature and attachment URLs in detail responses; without it they are null */
  files?: Pick<FilesService, "signedUrls">;
  now?: () => Date;
}

/* A 400 in the same shape the validate middleware produces, for checks that need the database */
const invalidField = (path: string, message: string) =>
  HttpError.badRequest("Request is invalid", [{ location: "body", path, message }]);

const alreadyProcured = () => HttpError.conflict("The purchase for this requisition has already been recorded");

/* Asset fields the caller supplies; code, tag ID and the people stamps are filled in on insert */
type NewAsset = Omit<CreationAttributes<Asset>, "code" | "issuedBy" | "issuedAt" | "createdBy">;

export function createAssetService(opts: AssetServiceOptions = {}) {
  const assetRepo = opts.assetRepo ?? assetRepository;
  const orgRepo = opts.orgRepo ?? orgRepository;
  const auditRepo = opts.auditRepo ?? auditRepository;
  const now = opts.now ?? (() => new Date());
  const today = () => todayIST(now());

  /* Assets outside the user's scope are reported as not found, so their existence is not revealed.
     People can always see what they hold. */
  const visible = (auth: AuthContext, a: Asset | null): Asset => {
    if (!a || !(inScope(assetScope(auth), a.dealershipId) || a.assignedTo === auth.user.id)) {
      throw HttpError.notFound("Asset not found");
    }
    return a;
  };

  const notDisposed = (a: Asset) => {
    if (a.status === "disposed") throw HttpError.conflict("This asset has been disposed of");
  };

  async function lock(id: string, t: Transaction) {
    const a = await assetRepo.lockById(id, t);
    if (!a) throw HttpError.notFound("Asset not found");
    return a;
  }

  /* Reference checks for a new asset: an active dealership, an active location of that
     dealership, an active department */
  async function placement(input: { dealershipId: string; facilityId: string | null; deptId: string | null }) {
    const dealership = await orgRepo.findDealershipById(input.dealershipId);
    if (!dealership?.active) throw invalidField("dealershipId", "No active dealership with this ID");
    if (input.facilityId) {
      const f = await orgRepo.findFacilityById(input.facilityId);
      if (!f?.active || f.dealershipId !== dealership.id) throw invalidField("facilityId", "Not an active location of this dealership");
    }
    if (input.deptId) {
      const d = await orgRepo.findDepartmentById(input.deptId);
      if (!d?.active) throw invalidField("deptId", "No active department with this ID");
    }
    return { dealership, facilityId: input.facilityId, deptId: input.deptId };
  }

  async function holder(dealershipId: string, userId: string, path: string) {
    const u = await orgRepo.findUserById(userId);
    if (!u || u.inactive || !(u.dealerships ?? []).some((d) => d.id === dealershipId)) {
      throw invalidField(path, "Not an active employee of this dealership");
    }
    return u;
  }

  /* One asset with its generated code and bundled accessories. A holder named here starts the
     custody history with an unacknowledged issue (method null), as in the prototype. */
  async function insert(auth: AuthContext, dealershipShort: string, a: NewAsset, bundled: string[], t: Transaction) {
    const date = a.purchaseDate ?? today();
    const prefix = assetCodePrefix(dealershipShort, a.category, date);
    const asset = await assetRepo.create({
      ...a,
      code: assetCode(prefix, await assetRepo.nextCodeNumber(prefix, t)),
      issuedBy: a.assignedTo ? auth.user.id : null,
      issuedAt: a.assignedTo ? now() : null,
      createdBy: auth.user.id,
    }, bundled.map((name, i) => ({
      position: i + 1, name, serial: "—", origin: "bundled" as const, cost: 0, addedAt: date, createdBy: auth.user.id,
    })), t);
    if (a.assignedTo) {
      const issue = await assetRepo.createEvent({
        assetId: asset.id, kind: "issue", holderId: a.assignedTo, actorId: auth.user.id, method: null,
        snapshot: [a.name, ...bundled], signatureFileId: null, note: null, condition: null, missing: [],
      }, t);
      await assetRepo.updateCustody(asset, { custodyEventId: issue.id }, t);
    }
    return asset;
  }

  /* Only possible if a code in the generated format was inserted outside the API */
  async function withCodes<T>(work: () => Promise<T>) {
    try {
      return await work();
    } catch (err) {
      if (err instanceof UniqueConstraintError) throw HttpError.conflict("The next asset code for this prefix is already in use");
      throw err;
    }
  }

  /* `a` must be loaded with findById / findByCode / findByTagId (custody history included) */
  async function detail(a: Asset): Promise<AssetDetailDto> {
    const refs = a.reqRef ? [a.code, a.reqRef] : [a.code];
    const [activity, attachments] = await Promise.all([auditRepo.list({ refs, limit: 100 }), assetRepo.attachmentsOf(a.id)]);
    /* One signing request for every file the page shows */
    const paths = [...signaturePaths(a), ...attachments.map((x) => x.file!.path)];
    const urls = opts.files && paths.length ? await opts.files.signedUrls(paths) : new Map<string, string>();
    return {
      ...toAssetDto(a, today(), urls),
      custodyHistory: (a.custodyHistory ?? []).map((e) => toCustodyEventDto(e, urls)),
      activity: activity.map(toAuditEntryDto),
      attachments: attachments.map((x) => toAttachmentDto(x, urls)),
    };
  }

  return {
    async list(auth: AuthContext, filter: { q?: string; dealershipId?: string; source?: AssetSource; status?: AssetStatus }) {
      const asOf = today();
      return (await assetRepo.list({ ...filter, scope: assetScope(auth) })).map((a) => toAssetDto(a, asOf));
    },

    async get(auth: AuthContext, id: string) {
      return detail(visible(auth, await assetRepo.findById(id)));
    },

    /* Scan view: a full code, or the numeric tag ID printed on small labels */
    async lookup(auth: AuthContext, code: string) {
      const a = /^\d{1,9}$/.test(code) ? await assetRepo.findByTagId(Number(code)) : await assetRepo.findByCode(code);
      return detail(visible(auth, a));
    },

    /* Opening stock: an asset already owned, not procured through the platform */
    async createExisting(auth: AuthContext, input: CreateAssetInput) {
      if (!auth.permissions.canAddExisting) throw HttpError.forbidden();
      const { dealership, deptId, ...placed } = await placement(input);
      let { facilityId } = placed;
      if (input.assignedTo) {
        const u = await holder(dealership.id, input.assignedTo, "assignedTo");
        /* Same as the prototype: an unplaced asset sits where its holder works */
        if (!facilityId && u.facilityId) {
          const home = await orgRepo.findFacilityById(u.facilityId);
          if (home?.active && home.dealershipId === dealership.id) facilityId = home.id;
        }
      }

      const id = await withCodes(() => assetRepo.transaction(async (t) => {
        const asset = await insert(auth, dealership.short, {
          name: input.name, category: input.category, make: input.make, model: input.model,
          serial: input.serial, purchaseDate: input.purchaseDate, cost: input.cost, vendor: input.vendor,
          dealershipId: dealership.id, facilityId, deptId, warranty: input.warranty,
          status: "in_use", source: "existing", reqRef: null, assignedTo: input.assignedTo,
          verified: null, invoiceDoc: input.invoiceDoc,
        }, input.bundled, t);
        await auditRepo.record({
          actorId: auth.user.id, action: "Added existing asset", ref: asset.code,
          detail: `Opening stock · ${inrFull(input.cost)} · ${dealership.name}`,
        }, t);
        return asset.id;
      }));
      return detail((await assetRepo.findById(id))!);
    },

    /* One requisition's purchase (D4): one asset per invoice line. A functional head's entry is
       verified at once; a dealership manager's awaits verification. Each requisition reference
       can be procured once, so a requisition that reset in the browser cannot buy twice. */
    async createProcured(auth: AuthContext, input: ProcuredInput) {
      if (!auth.permissions.canProcure) throw HttpError.forbidden();
      if (!inScope(assetScope(auth), input.dealershipId)) throw HttpError.forbidden("You cannot record purchases for this dealership");
      const { dealership, facilityId, deptId } = await placement(input);
      for (const [i, line] of input.assets.entries()) {
        if (line.assignedTo) await holder(dealership.id, line.assignedTo, `assets.${i}.assignedTo`);
      }

      const verified = auth.permissions.isFnHead;
      const total = Math.round(input.assets.reduce((s, x) => s + x.cost, 0) * 100) / 100;
      const recordedAt = now();
      const ids = await withCodes(() => assetRepo.transaction(async (t) => {
        try {
          await assetRepo.createProcurement({
            reqRef: input.reqRef, dealershipId: dealership.id, vendor: input.vendor, invoiceNo: input.invoiceNo,
            purchaseDate: input.purchaseDate, total, invoiceDoc: input.invoiceDoc, verified,
            recordedBy: auth.user.id, recordedAt,
          }, t);
        } catch (err) {
          if (err instanceof UniqueConstraintError) throw alreadyProcured();
          throw err;
        }
        /* Seeded assets carry requisition references without a procurement row */
        if (await assetRepo.countByReqRef(input.reqRef, t)) throw alreadyProcured();

        const created: string[] = [];
        for (const line of input.assets) {
          const asset = await insert(auth, dealership.short, {
            name: line.name, category: line.category, make: line.make, model: line.model, serial: line.serial,
            purchaseDate: input.purchaseDate, cost: line.cost, vendor: input.vendor,
            dealershipId: dealership.id, facilityId, deptId, warranty: line.warranty,
            status: "in_use", source: "procured", reqRef: input.reqRef, assignedTo: line.assignedTo,
            verified, invoiceDoc: null,
          }, line.bundled, t);
          created.push(asset.id);
        }
        await auditRepo.record({
          actorId: auth.user.id, ref: input.reqRef,
          action: verified ? "Procured requisition" : "Entered procured assets — awaiting verification",
          detail: `${created.length} asset(s) · ${inrFull(total)} · ${input.vendor}`,
        }, t);
        return created;
      }));

      const asOf = today();
      const assets = (await Promise.all(ids.map((id) => assetRepo.findById(id)))).map((a) => toAssetDto(a!, asOf));
      return {
        reqRef: input.reqRef, by: auth.user.id, at: recordedAt.toISOString(), actualCost: total,
        vendor: input.vendor, invoice: input.invoiceNo, invoiceDoc: input.invoiceDoc, verified,
        assetCodes: assets.map((a) => a.code), assets,
      };
    },

    async addAccessory(auth: AuthContext, id: string, input: AccessoryInput) {
      if (!auth.permissions.canAddExisting) throw HttpError.forbidden();
      visible(auth, await assetRepo.findById(id));
      await assetRepo.transaction(async (t) => {
        const a = await lock(id, t);
        notDisposed(a);
        const existing = await assetRepo.accessoriesOf(id, t);
        await assetRepo.addAccessory({
          assetId: id, position: Math.max(0, ...existing.map((x) => x.position)) + 1,
          name: input.name, serial: input.serial, origin: input.origin, cost: input.cost,
          addedAt: input.addedAt ?? today(), createdBy: auth.user.id,
        }, t);
        await auditRepo.record({
          actorId: auth.user.id, action: "Added accessory", ref: a.code,
          detail: `${input.name} · ${input.origin === "bundled" ? "bundled with asset" : `${inrFull(input.cost)} expensed`}`,
        }, t);
      });
      return detail((await assetRepo.findById(id))!);
    },

    /* Write-off. An issued asset must come back first, so its return (and any missing items)
       is on record before it leaves the register. */
    async dispose(auth: AuthContext, id: string, input: DisposeInput) {
      if (!auth.permissions.canDispose) throw HttpError.forbidden();
      visible(auth, await assetRepo.findById(id));
      await assetRepo.transaction(async (t) => {
        const a = await lock(id, t);
        notDisposed(a);
        if (a.assignedTo) throw HttpError.conflict("This asset is issued to someone; record its return first");
        const disposedAt = now();
        const nbv = depreciation({ category: a.category, purchaseDate: a.purchaseDate, cost: Number(a.cost) }, todayIST(disposedAt))?.nbv;
        await assetRepo.dispose(a, {
          assetId: id, reason: input.reason, scrapValue: input.scrapValue,
          bookValue: nbv === undefined ? null : Math.round(nbv * 100) / 100,
          disposedBy: auth.user.id, disposedAt,
        }, t);
        await auditRepo.record({
          actorId: auth.user.id, action: "Disposed asset", ref: a.code,
          detail: `${input.reason}${input.scrapValue !== null ? ` · scrap ${inrFull(input.scrapValue)}` : ""}`,
        }, t);
      });
      return detail((await assetRepo.findById(id))!);
    },
  };
}

export type AssetService = ReturnType<typeof createAssetService>;
