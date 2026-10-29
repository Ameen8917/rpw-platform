import type { Migration } from "../migrator.js";

/* Custody (M4): every issue, acceptance and return is an event row, so the full history is kept.
   The asset points at its current issue, the event that acknowledged it, and its last return.
   Files (signatures now, invoices later) are references to objects in Supabase Storage. */
export const up: Migration = async ({ context: { schema, query: q } }) => {
  const s = `"${schema}"`;

  await q(`
    CREATE TABLE ${s}.files (
      id            uuid         PRIMARY KEY,
      bucket        text         NOT NULL,
      path          text         NOT NULL UNIQUE,
      content_type  text         NOT NULL,
      size_bytes    integer      NOT NULL CHECK (size_bytes > 0),
      sha256        char(64)     NOT NULL,
      purpose       varchar(20)  NOT NULL CHECK (purpose IN ('signature', 'invoice')),
      uploaded_by   varchar(40)  NOT NULL REFERENCES ${s}.users(id),
      created_at    timestamptz  NOT NULL DEFAULT now()
    )`);

  /* issue:  holder = recipient, actor = issuer, method = in_app | signature | NULL (holder named
             when the asset was registered), snapshot = items handed over (frozen)
     accept: holder = actor = recipient, snapshot = items confirmed
     return: holder = person returning, actor = receiver, condition, missing items */
  await q(`
    CREATE TABLE ${s}.asset_custody_events (
      id                 uuid         PRIMARY KEY,
      asset_id           uuid         NOT NULL REFERENCES ${s}.assets(id) ON DELETE CASCADE,
      kind               varchar(10)  NOT NULL CHECK (kind IN ('issue', 'accept', 'return')),
      at                 timestamptz  NOT NULL DEFAULT now(),
      holder_id          varchar(40)  NOT NULL REFERENCES ${s}.users(id),
      actor_id           varchar(40)  NOT NULL REFERENCES ${s}.users(id),
      method             varchar(10)  CHECK (method IN ('in_app', 'signature')),
      snapshot           text[]       NOT NULL DEFAULT '{}',
      signature_file_id  uuid         REFERENCES ${s}.files(id),
      note               text,
      condition          text         CHECK (condition IN ('Good', 'Minor damage', 'Damaged — needs repair', 'Not working')),
      missing            text[]       NOT NULL DEFAULT '{}',
      CONSTRAINT custody_signature_when_signed CHECK (method IS DISTINCT FROM 'signature' OR signature_file_id IS NOT NULL),
      CONSTRAINT custody_return_fields CHECK ((kind = 'return') = (condition IS NOT NULL)),
      CONSTRAINT custody_return_signed CHECK (kind <> 'return' OR signature_file_id IS NOT NULL)
    )`);
  await q(`CREATE INDEX custody_events_asset_idx ON ${s}.asset_custody_events (asset_id, at DESC)`);
  await q(`CREATE INDEX custody_events_holder_idx ON ${s}.asset_custody_events (holder_id)`);

  await q(`ALTER TABLE ${s}.assets
    ADD COLUMN custody_event_id     uuid REFERENCES ${s}.asset_custody_events(id),
    ADD COLUMN acceptance_event_id  uuid REFERENCES ${s}.asset_custody_events(id),
    ADD COLUMN return_event_id      uuid REFERENCES ${s}.asset_custody_events(id),
    ADD CONSTRAINT assets_custody_needs_holder CHECK (custody_event_id IS NULL OR assigned_to IS NOT NULL),
    ADD CONSTRAINT assets_acceptance_needs_holder CHECK (acceptance_event_id IS NULL OR assigned_to IS NOT NULL)`);
};

export const down: Migration = async ({ context: { schema, query: q } }) => {
  const s = `"${schema}"`;
  await q(`ALTER TABLE ${s}.assets
    DROP COLUMN custody_event_id, DROP COLUMN acceptance_event_id, DROP COLUMN return_event_id`);
  await q(`DROP TABLE ${s}.asset_custody_events, ${s}.files`);
};
