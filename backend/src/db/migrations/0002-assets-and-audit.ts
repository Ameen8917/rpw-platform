import type { Migration } from "../migrator.js";

/* Asset register (M3) and the platform-wide audit log.
   Custody history, disposals, files and settings arrive with their milestones (M4, M5). */
export const up: Migration = async ({ context: { schema, query: q } }) => {
  const s = `"${schema}"`;

  /* Short numeric tag printed on small labels; the prototype numbered from 100001 */
  await q(`CREATE SEQUENCE ${s}.asset_tag_seq START 100001`);

  await q(`
    CREATE TABLE ${s}.assets (
      id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
      code           text          NOT NULL UNIQUE,
      tag_id         integer       NOT NULL UNIQUE DEFAULT nextval('${schema}.asset_tag_seq'),
      name           text          NOT NULL,
      category       text          NOT NULL CHECK (category IN ('IT Equipment', 'IT – Servers & Network', 'Diagnostic Equipment',
                                     'Workshop Equipment', 'Machinery & Power', 'Furniture & Fixtures', 'Office Equipment', 'Internal Vehicles')),
      make           text          NOT NULL DEFAULT '',
      model          text          NOT NULL DEFAULT '',
      serial         text          NOT NULL DEFAULT '',
      purchase_date  date,
      cost           numeric(14,2) NOT NULL CHECK (cost >= 0),
      vendor         text          NOT NULL DEFAULT '',
      dealership_id  varchar(40)   NOT NULL REFERENCES ${s}.dealerships(id),
      facility_id    varchar(40)   REFERENCES ${s}.facilities(id),
      dept_id        varchar(40)   REFERENCES ${s}.departments(id),
      warranty       date,
      status         varchar(20)   NOT NULL DEFAULT 'in_use' CHECK (status IN ('in_use', 'in_storage', 'under_repair', 'disposed')),
      source         varchar(20)   NOT NULL CHECK (source IN ('existing', 'procured')),
      req_ref        text,
      assigned_to    varchar(40)   REFERENCES ${s}.users(id),
      issued_by      varchar(40)   REFERENCES ${s}.users(id),
      issued_at      timestamptz,
      verified       boolean,
      invoice_doc    jsonb,
      created_by     varchar(40)   REFERENCES ${s}.users(id),
      created_at     timestamptz   NOT NULL DEFAULT now(),
      updated_at     timestamptz   NOT NULL DEFAULT now(),
      CONSTRAINT assets_procured_has_req CHECK (source <> 'procured' OR req_ref IS NOT NULL)
    )`);
  await q(`ALTER SEQUENCE ${s}.asset_tag_seq OWNED BY ${s}.assets.tag_id`);
  await q(`CREATE INDEX assets_dealership_idx ON ${s}.assets (dealership_id)`);
  await q(`CREATE INDEX assets_assigned_to_idx ON ${s}.assets (assigned_to)`);
  await q(`CREATE INDEX assets_req_ref_idx ON ${s}.assets (req_ref)`);
  /* Case-insensitive exact lookup by code (scan view) */
  await q(`CREATE INDEX assets_code_lower_idx ON ${s}.assets (lower(code))`);

  /* position gives the -A1, -A2 sub-codes and never changes once assigned */
  await q(`
    CREATE TABLE ${s}.asset_accessories (
      id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
      asset_id    uuid          NOT NULL REFERENCES ${s}.assets(id) ON DELETE CASCADE,
      position    integer       NOT NULL CHECK (position > 0),
      name        text          NOT NULL,
      serial      text          NOT NULL DEFAULT '—',
      origin      varchar(10)   NOT NULL CHECK (origin IN ('bundled', 'separate')),
      cost        numeric(14,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
      added_at    date          NOT NULL,
      status      text          NOT NULL DEFAULT 'with_asset',
      created_by  varchar(40)   REFERENCES ${s}.users(id),
      created_at  timestamptz   NOT NULL DEFAULT now(),
      UNIQUE (asset_id, position)
    )`);

  /* Next number per code prefix "RPW/<short>/<cat>/<FY>/". Incremented with an upsert inside the
     transaction that inserts the asset, so the row lock serialises concurrent adds. */
  await q(`
    CREATE TABLE ${s}.asset_code_sequences (
      prefix      text        PRIMARY KEY,
      last_value  integer     NOT NULL CHECK (last_value > 0),
      updated_at  timestamptz NOT NULL DEFAULT now()
    )`);

  await q(`
    CREATE TABLE ${s}.audit_log (
      id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
      at        timestamptz  NOT NULL DEFAULT now(),
      actor_id  varchar(40)  NOT NULL REFERENCES ${s}.users(id),
      action    text         NOT NULL,
      ref       text         NOT NULL,
      detail    text         NOT NULL DEFAULT ''
    )`);
  await q(`CREATE INDEX audit_log_at_idx ON ${s}.audit_log (at DESC)`);
  await q(`CREATE INDEX audit_log_ref_idx ON ${s}.audit_log (ref)`);

  /* Append-only: entries can be added, never changed or removed */
  await q(`
    CREATE FUNCTION ${s}.audit_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'audit_log is append-only';
    END $$`);
  await q(`
    CREATE TRIGGER audit_log_no_update_delete BEFORE UPDATE OR DELETE ON ${s}.audit_log
    FOR EACH ROW EXECUTE FUNCTION ${s}.audit_log_append_only()`);
};

export const down: Migration = async ({ context: { schema, query: q } }) => {
  const s = `"${schema}"`;
  await q(`DROP TABLE ${s}.audit_log, ${s}.asset_code_sequences, ${s}.asset_accessories, ${s}.assets`);
  await q(`DROP FUNCTION ${s}.audit_log_append_only()`);
};
