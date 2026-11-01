import type { Transaction } from "sequelize";
import { HttpError } from "../../lib/http-error.js";
import { auditRepository, type AuditRepository } from "../audit/audit.repository.js";
import type { AuthContext } from "../auth/auth.service.js";
import { checkAttachment, type FilesService } from "../files/files.service.js";
import { assetScope, inScope } from "./asset-rules.js";
import { assetRepository, type AssetRepository } from "./assets.repository.js";
import type { AssetService } from "./assets.service.js";
import type { AttachmentQuery } from "./attachments.schemas.js";

export interface AttachmentServiceOptions {
  assets: AssetService;
  files: Pick<FilesService, "storeAttachment" | "record" | "discard">;
  assetRepo?: AssetRepository;
  auditRepo?: AuditRepository;
}

/** Shown attachments per asset; removed ones do not count */
export const MAX_ATTACHMENTS = 20;

const KIND_LABEL = { invoice: "invoice", photo: "photo", document: "document" } as const;

/* Invoices, photos and documents kept with an asset. Same people as adding and issuing assets
   (functional heads, Director); allowed on disposed assets too, for write-off papers.
   Removing only hides the attachment; the file and who removed it stay on record. */
export function createAttachmentService(opts: AttachmentServiceOptions) {
  const assetRepo = opts.assetRepo ?? assetRepository;
  const auditRepo = opts.auditRepo ?? auditRepository;

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

  return {
    async add(auth: AuthContext, id: string, input: AttachmentQuery, body: unknown) {
      if (!auth.permissions.canAddExisting) throw HttpError.forbidden();
      await loadVisible(auth, id);
      /* Refuse a bad file before anything is uploaded */
      checkAttachment(body, input.kind);

      /* Storage is outside the transaction: upload first, remove the upload if the transaction fails */
      const upload = await opts.files.storeAttachment(body, input.kind, input.name);
      try {
        await assetRepo.transaction(async (t) => {
          const a = await lock(id, t);
          if ((await assetRepo.attachmentsOf(id, t)).length >= MAX_ATTACHMENTS) {
            throw HttpError.conflict(`This asset already has ${MAX_ATTACHMENTS} attachments; remove one first`);
          }
          await opts.files.record(upload, auth.user.id, t);
          await assetRepo.addAttachment({ assetId: id, fileId: upload.id, kind: input.kind, caption: input.caption, addedBy: auth.user.id }, t);
          await auditRepo.record({
            actorId: auth.user.id, action: `Attached ${KIND_LABEL[input.kind]}`, ref: a.code,
            detail: `${input.name}${input.caption ? ` · ${input.caption}` : ""}`,
          }, t);
        });
      } catch (err) {
        await opts.files.discard(upload);
        throw err;
      }
      return opts.assets.get(auth, id);
    },

    async remove(auth: AuthContext, id: string, attachmentId: string) {
      if (!auth.permissions.canAddExisting) throw HttpError.forbidden();
      await loadVisible(auth, id);
      await assetRepo.transaction(async (t) => {
        const a = await lock(id, t);
        const x = await assetRepo.findAttachment(id, attachmentId, t);
        if (!x || x.removedAt) throw HttpError.notFound("Attachment not found");
        await assetRepo.removeAttachment(x, auth.user.id, t);
        await auditRepo.record({
          actorId: auth.user.id, action: "Removed attachment", ref: a.code,
          detail: `${KIND_LABEL[x.kind]} · ${x.file?.fileName ?? "file"}${x.caption ? ` · ${x.caption}` : ""}`,
        }, t);
      });
      return opts.assets.get(auth, id);
    },
  };
}

export type AttachmentService = ReturnType<typeof createAttachmentService>;
