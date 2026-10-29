import type { Transaction } from "sequelize";
import { HttpError } from "../../lib/http-error.js";
import { auditRepository, type AuditRepository } from "../audit/audit.repository.js";
import type { AuthContext } from "../auth/auth.service.js";
import type { FilesService, PendingUpload } from "../files/files.service.js";
import { orgRepository, type OrgRepository } from "../org/org.repository.js";
import { assetScope, inScope, todayIST } from "./asset-rules.js";
import { toAssetDto, type AssetDto } from "./assets.dto.js";
import type { Asset } from "./assets.models.js";
import { assetRepository, type AssetRepository } from "./assets.repository.js";
import type { AssetService } from "./assets.service.js";
import type { CustodyQuery, IssueInput, ReturnInput } from "./custody.schemas.js";

export interface CustodyServiceOptions {
  assets: AssetService;
  files: Pick<FilesService, "storeSignature" | "record" | "discard">;
  assetRepo?: AssetRepository;
  orgRepo?: OrgRepository;
  auditRepo?: AuditRepository;
  now?: () => Date;
}

const invalidField = (path: string, message: string) =>
  HttpError.badRequest("Request is invalid", [{ location: "body", path, message }]);

/* Issue → (accept) → return. Each step is an event row; the asset row points at the current ones.
   Every change locks the asset row and re-checks its state inside the transaction, so two people
   acting on one asset at once cannot both succeed. */
export function createCustodyService(opts: CustodyServiceOptions) {
  const assetRepo = opts.assetRepo ?? assetRepository;
  const orgRepo = opts.orgRepo ?? orgRepository;
  const auditRepo = opts.auditRepo ?? auditRepository;
  const now = opts.now ?? (() => new Date());

  /* Same rule as reading: unseen assets are not found */
  async function loadVisible(auth: AuthContext, id: string) {
    const a = await assetRepo.findById(id);
    if (!a || !(inScope(assetScope(auth), a.dealershipId) || a.assignedTo === auth.user.id)) {
      throw HttpError.notFound("Asset not found");
    }
    return a;
  }

  async function lock(id: string, t: Transaction) {
    const a = await assetRepo.lockById(id, t);
    if (!a) throw HttpError.notFound("Asset not found");
    return a;
  }

  async function currentItems(a: Asset, t: Transaction) {
    return [a.name, ...(await assetRepo.accessoriesOf(a.id, t)).map((x) => x.name)];
  }

  /* Storage is outside the transaction: upload first, remove the upload if the transaction fails */
  async function withUpload<T>(signature: string | null | undefined, work: (u: PendingUpload | null) => Promise<T>) {
    const upload = signature ? await opts.files.storeSignature(signature) : null;
    try {
      return await work(upload);
    } catch (err) {
      await opts.files.discard(upload);
      throw err;
    }
  }

  const notDisposed = (a: Asset) => {
    if (a.status === "disposed") throw HttpError.conflict("This asset has been disposed of");
  };
  const notIssued = (a: Asset) => {
    if (a.assignedTo) throw HttpError.conflict("This asset is already issued; record its return first");
  };

  return {
    async issue(auth: AuthContext, id: string, input: IssueInput) {
      if (!auth.permissions.canAddExisting) throw HttpError.forbidden();
      const before = await loadVisible(auth, id);
      notDisposed(before);
      notIssued(before);

      const holder = await orgRepo.findUserById(input.userId);
      if (!holder || holder.inactive || !(holder.dealerships ?? []).some((d) => d.id === before.dealershipId)) {
        throw invalidField("userId", "Not an active employee of this asset's dealership");
      }
      if (!holder.canLogin && input.method === "in_app") {
        throw invalidField("method", `${holder.name} has no login, so acknowledgement is by signature at handover`);
      }

      await withUpload(input.signature, (upload) => assetRepo.transaction(async (t) => {
        const a = await lock(id, t);
        notDisposed(a);
        notIssued(a);
        /* The list is built here, not taken from the client: it is what the holder answers for */
        const snapshot = await currentItems(a, t);
        if (upload) await opts.files.record(upload, auth.user.id, t);
        const issue = await assetRepo.createEvent({
          assetId: a.id, kind: "issue", holderId: holder.id, actorId: auth.user.id, method: input.method, snapshot,
          signatureFileId: upload?.id ?? null, note: input.note || null, condition: null, missing: [],
        }, t);
        await assetRepo.updateCustody(a, {
          assignedTo: holder.id, issuedBy: auth.user.id, issuedAt: now(), custodyEventId: issue.id,
          acceptanceEventId: input.method === "signature" ? issue.id : null, returnEventId: null,
        }, t);
        await auditRepo.record({
          actorId: auth.user.id,
          action: input.method === "signature" ? "Issued asset — signed at handover" : "Issued asset — acceptance pending",
          ref: a.code, detail: `${holder.name} (${holder.empCode}) · ${snapshot.length} item(s)`,
        }, t);
      }));
      return opts.assets.get(auth, id);
    },

    /* Only the holder confirms, from their own login */
    async accept(auth: AuthContext, id: string) {
      await loadVisible(auth, id);
      await assetRepo.transaction(async (t) => {
        const a = await lock(id, t);
        if (a.assignedTo !== auth.user.id) throw HttpError.forbidden("Only the person it was issued to can accept it");
        if (a.acceptanceEventId) throw HttpError.conflict("Receipt has already been acknowledged");
        const issue = a.custodyEventId ? await assetRepo.findEvent(a.custodyEventId, t) : null;
        /* Assets issued before custody events existed (seed data) have no frozen list: use today's */
        const snapshot = issue?.snapshot.length ? issue.snapshot : await currentItems(a, t);
        const accept = await assetRepo.createEvent({
          assetId: a.id, kind: "accept", holderId: auth.user.id, actorId: auth.user.id, method: "in_app", snapshot,
          signatureFileId: null, note: null, condition: null, missing: [],
        }, t);
        await assetRepo.updateCustody(a, { acceptanceEventId: accept.id }, t);
        await auditRepo.record({
          actorId: auth.user.id, action: "Asset receipt accepted", ref: a.code,
          detail: `${auth.user.name} confirmed ${snapshot.length} item(s) in app`,
        }, t);
      });
      return opts.assets.get(auth, id);
    },

    async recordReturn(auth: AuthContext, id: string, input: ReturnInput) {
      if (!auth.permissions.canAddExisting) throw HttpError.forbidden();
      const before = await loadVisible(auth, id);
      notDisposed(before);
      if (!before.assignedTo) throw HttpError.conflict("This asset is not issued to anyone");

      await withUpload(input.signature, (upload) => assetRepo.transaction(async (t) => {
        const a = await lock(id, t);
        notDisposed(a);
        if (!a.assignedTo) throw HttpError.conflict("This asset is not issued to anyone");
        /* What they answer for: the acknowledged list, else the issued list, else today's items */
        const acknowledged = a.acceptanceEventId ? await assetRepo.findEvent(a.acceptanceEventId, t) : null;
        const issued = a.custodyEventId ? await assetRepo.findEvent(a.custodyEventId, t) : null;
        const items = acknowledged?.snapshot.length ? acknowledged.snapshot
          : issued?.snapshot.length ? issued.snapshot : await currentItems(a, t);
        const unknown = input.missing.filter((m) => !items.includes(m));
        if (unknown.length) throw invalidField("missing", `Not on the handover list: ${unknown.join(", ")}`);

        const holder = await orgRepo.findUserById(a.assignedTo);
        await opts.files.record(upload!, auth.user.id, t);
        const ret = await assetRepo.createEvent({
          assetId: a.id, kind: "return", holderId: a.assignedTo, actorId: auth.user.id, method: null, snapshot: items,
          signatureFileId: upload!.id, note: null, condition: input.condition, missing: input.missing,
        }, t);
        await assetRepo.updateCustody(a, {
          assignedTo: null, issuedBy: null, issuedAt: null, custodyEventId: null, acceptanceEventId: null, returnEventId: ret.id,
        }, t);
        const missing = input.missing.length ? ` · not returned: ${input.missing.join(", ")}` : "";
        await auditRepo.record({
          actorId: auth.user.id, action: "Asset returned", ref: a.code,
          detail: `From ${holder?.name ?? a.assignedTo} · ${input.condition}${missing}`,
        }, t);
      }));
      return opts.assets.get(auth, id);
    },

    /* Who holds what, grouped by person. Director and functional heads see every dealership,
       Business Heads their own. */
    async register(auth: AuthContext, filter: CustodyQuery) {
      const p = auth.permissions;
      if (!(p.isDirector || p.isFnHead || p.isBH)) throw HttpError.forbidden();
      const asOf = todayIST(now());
      const assets = (await assetRepo.listIssued({ ...filter, scope: assetScope(auth) })).map((a) => toAssetDto(a, asOf));

      const byHolder = new Map<string, AssetDto[]>();
      for (const a of assets) byHolder.set(a.assignedTo!, [...(byHolder.get(a.assignedTo!) ?? []), a]);
      const summarise = (list: AssetDto[]) => ({
        assets: list.length,
        items: list.reduce((n, a) => n + 1 + a.accessories.length, 0),
        value: list.reduce((n, a) => n + a.cost, 0),
        pendingAcceptance: list.filter((a) => !a.acceptance).length,
      });
      const people = [...byHolder.entries()]
        .map(([userId, list]) => ({ userId, ...summarise(list), holdings: list }))
        .sort((x, y) => y.assets - x.assets || x.userId.localeCompare(y.userId));
      return { totals: { people: people.length, ...summarise(assets) }, people };
    },
  };
}

export type CustodyService = ReturnType<typeof createCustodyService>;
