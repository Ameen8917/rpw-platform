import { UniqueConstraintError } from "sequelize";
import { HttpError } from "../../lib/http-error.js";
import { auditRepository, type AuditRepository } from "../audit/audit.repository.js";
import { toAuditEntryDto } from "../audit/audit.dto.js";
import type { AuthContext } from "../auth/auth.service.js";
import type { FilesService } from "../files/files.service.js";
import { orgRepository, type OrgRepository } from "../org/org.repository.js";
import { assetCode, assetCodePrefix, assetScope, inrFull, inScope, todayIST, type AssetSource, type AssetStatus } from "./asset-rules.js";
import { signaturePaths, toAssetDto, toCustodyEventDto, type AssetDetailDto } from "./assets.dto.js";
import type { Asset } from "./assets.models.js";
import { assetRepository, type AssetRepository } from "./assets.repository.js";
import type { CreateAssetInput } from "./assets.schemas.js";

export interface AssetServiceOptions {
  assetRepo?: AssetRepository;
  orgRepo?: OrgRepository;
  auditRepo?: AuditRepository;
  /** Signs signature image URLs in detail responses; without it they are null */
  files?: Pick<FilesService, "signedUrls">;
  now?: () => Date;
}

/* A 400 in the same shape the validate middleware produces, for checks that need the database */
const invalidField = (path: string, message: string) =>
  HttpError.badRequest("Request is invalid", [{ location: "body", path, message }]);

export function createAssetService(opts: AssetServiceOptions = {}) {
  const assetRepo = opts.assetRepo ?? assetRepository;
  const orgRepo = opts.orgRepo ?? orgRepository;
  const auditRepo = opts.auditRepo ?? auditRepository;
  const today = () => todayIST((opts.now ?? (() => new Date()))());

  /* Assets outside the user's scope are reported as not found, so their existence is not revealed.
     People can always see what they hold. */
  const visible = (auth: AuthContext, a: Asset | null): Asset => {
    if (!a || !(inScope(assetScope(auth), a.dealershipId) || a.assignedTo === auth.user.id)) {
      throw HttpError.notFound("Asset not found");
    }
    return a;
  };

  /* `a` must be loaded with findById / findByCode / findByTagId (custody history included) */
  async function detail(a: Asset): Promise<AssetDetailDto> {
    const refs = a.reqRef ? [a.code, a.reqRef] : [a.code];
    const [activity, urls] = await Promise.all([
      auditRepo.list({ refs, limit: 100 }),
      opts.files ? opts.files.signedUrls(signaturePaths(a)) : Promise.resolve(new Map<string, string>()),
    ]);
    return {
      ...toAssetDto(a, today(), urls),
      custodyHistory: (a.custodyHistory ?? []).map((e) => toCustodyEventDto(e, urls)),
      activity: activity.map(toAuditEntryDto),
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

      const dealership = await orgRepo.findDealershipById(input.dealershipId);
      if (!dealership?.active) throw invalidField("dealershipId", "No active dealership with this ID");

      let facilityId = input.facilityId;
      if (facilityId) {
        const f = await orgRepo.findFacilityById(facilityId);
        if (!f?.active || f.dealershipId !== dealership.id) throw invalidField("facilityId", "Not an active location of this dealership");
      }
      if (input.deptId) {
        const d = await orgRepo.findDepartmentById(input.deptId);
        if (!d?.active) throw invalidField("deptId", "No active department with this ID");
      }
      if (input.assignedTo) {
        const u = await orgRepo.findUserById(input.assignedTo);
        if (!u || u.inactive || !(u.dealerships ?? []).some((d) => d.id === dealership.id)) {
          throw invalidField("assignedTo", "Not an active employee of this dealership");
        }
        /* Same as the prototype: an unplaced asset sits where its holder works */
        if (!facilityId && u.facilityId) {
          const home = await orgRepo.findFacilityById(u.facilityId);
          if (home?.active && home.dealershipId === dealership.id) facilityId = home.id;
        }
      }

      const date = today();
      const prefix = assetCodePrefix(dealership.short, input.category, input.purchaseDate ?? date);
      try {
        const id = await assetRepo.transaction(async (t) => {
          const code = assetCode(prefix, await assetRepo.nextCodeNumber(prefix, t));
          const asset = await assetRepo.create({
            code, name: input.name, category: input.category, make: input.make, model: input.model,
            serial: input.serial, purchaseDate: input.purchaseDate, cost: input.cost, vendor: input.vendor,
            dealershipId: dealership.id, facilityId, deptId: input.deptId, warranty: input.warranty,
            status: "in_use", source: "existing", reqRef: null,
            assignedTo: input.assignedTo,
            issuedBy: input.assignedTo ? auth.user.id : null,
            issuedAt: input.assignedTo ? new Date() : null,
            verified: null, invoiceDoc: input.invoiceDoc, createdBy: auth.user.id,
          }, input.bundled.map((name, i) => ({
            position: i + 1, name, serial: "—", origin: "bundled" as const, cost: 0,
            addedAt: input.purchaseDate ?? date, createdBy: auth.user.id,
          })), t);
          if (input.assignedTo) {
            /* Named at registration: custody starts unacknowledged (method null), as in the prototype */
            const issue = await assetRepo.createEvent({
              assetId: asset.id, kind: "issue", holderId: input.assignedTo, actorId: auth.user.id, method: null,
              snapshot: [input.name, ...input.bundled], signatureFileId: null, note: null, condition: null, missing: [],
            }, t);
            await assetRepo.updateCustody(asset, { custodyEventId: issue.id }, t);
          }
          await auditRepo.record({
            actorId: auth.user.id, action: "Added existing asset", ref: code,
            detail: `Opening stock · ${inrFull(input.cost)} · ${dealership.name}`,
          }, t);
          return asset.id;
        });
        return detail((await assetRepo.findById(id))!);
      } catch (err) {
        /* Only possible if a code in the generated format was inserted outside the API */
        if (err instanceof UniqueConstraintError) throw HttpError.conflict("The next asset code for this prefix is already in use");
        throw err;
      }
    },
  };
}

export type AssetService = ReturnType<typeof createAssetService>;
