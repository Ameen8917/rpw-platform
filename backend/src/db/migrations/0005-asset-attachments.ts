import type { Migration } from "../migrator.js";

/* Attachments: invoices, photos and documents kept with an asset, stored in Supabase Storage
   like signatures. Removing one only hides it (who and when are kept, and the audit log has
   the entry); the file stays in Storage. */
export const up: Migration = async ({ context: { schema, query: q } }) => {
  const s = `"${schema}"`;

  await q(`ALTER TABLE ${s}.files
    DROP CONSTRAINT files_purpose_check,
    ADD CONSTRAINT files_purpose_check CHECK (purpose IN ('signature', 'invoice', 'photo', 'document')),
    ADD COLUMN file_name text`);

  await q(`
    CREATE TABLE ${s}.asset_attachments (
      id          uuid          PRIMARY KEY,
      asset_id    uuid          NOT NULL REFERENCES ${s}.assets(id) ON DELETE CASCADE,
      file_id     uuid          NOT NULL REFERENCES ${s}.files(id),
      kind        varchar(10)   NOT NULL CHECK (kind IN ('invoice', 'photo', 'document')),
      caption     text          NOT NULL DEFAULT '',
      added_by    varchar(40)   NOT NULL REFERENCES ${s}.users(id),
      added_at    timestamptz   NOT NULL DEFAULT now(),
      removed_by  varchar(40)   REFERENCES ${s}.users(id),
      removed_at  timestamptz,
      CONSTRAINT attachment_removal_complete CHECK ((removed_by IS NULL) = (removed_at IS NULL))
    )`);
  await q(`CREATE INDEX asset_attachments_asset_idx ON ${s}.asset_attachments (asset_id, added_at)`);
};

export const down: Migration = async ({ context: { schema, query: q } }) => {
  const s = `"${schema}"`;
  await q(`DROP TABLE ${s}.asset_attachments`);
  await q(`ALTER TABLE ${s}.files
    DROP COLUMN file_name,
    DROP CONSTRAINT files_purpose_check,
    ADD CONSTRAINT files_purpose_check CHECK (purpose IN ('signature', 'invoice'))`);
};
