import type { Migration } from "../migrator.js";

/* M8–M11: requisitions with their approvals and payments, the reference sequence, group
   settings, and verification of a purchase entered by a dealership manager. */
export const up: Migration = async ({ context: { schema, query: q } }) => {
  const s = `"${schema}"`;

  await q(`
    CREATE TABLE ${s}.requisitions (
      id                 uuid           PRIMARY KEY,
      ref                text           NOT NULL UNIQUE,
      dealership_id      varchar(40)    NOT NULL REFERENCES ${s}.dealerships(id),
      facility_id        varchar(40)    REFERENCES ${s}.facilities(id),
      dept_id            varchar(40)    NOT NULL REFERENCES ${s}.departments(id),
      item               text           NOT NULL CHECK (length(trim(item)) > 0),
      qty                integer        NOT NULL CHECK (qty > 0),
      est_cost           numeric(14,2)  NOT NULL CHECK (est_cost > 0),
      justification      text           NOT NULL,
      raised_by          varchar(40)    NOT NULL REFERENCES ${s}.users(id),
      raised_at          timestamptz    NOT NULL DEFAULT now(),
      advance_required   boolean        NOT NULL DEFAULT false,
      advance_amount     numeric(14,2)  NOT NULL DEFAULT 0 CHECK (advance_amount >= 0),
      advance_terms      text           NOT NULL DEFAULT '',
      expected_delivery  date,
      revision_of        text,
      resubmitted_as     text,
      sent_back_by       varchar(40)    REFERENCES ${s}.users(id),
      sent_back_at       timestamptz,
      sent_back_note     text,
      created_at         timestamptz    NOT NULL DEFAULT now(),
      updated_at         timestamptz    NOT NULL DEFAULT now()
    )`);
  await q(`CREATE INDEX requisitions_dealership_idx ON ${s}.requisitions (dealership_id)`);

  await q(`
    CREATE TABLE ${s}.requisition_approvals (
      requisition_id  uuid          NOT NULL REFERENCES ${s}.requisitions(id),
      stage           varchar(20)   NOT NULL CHECK (stage IN ('bh', 'fn', 'directorPurchase', 'advanceApproval',
                        'advanceFinance', 'advanceDirector', 'varianceApproval', 'financeApproval', 'directorApproval')),
      decision        varchar(10)   NOT NULL CHECK (decision IN ('approved', 'rejected', 'held', 'queried')),
      decided_by      varchar(40)   NOT NULL REFERENCES ${s}.users(id),
      decided_at      timestamptz   NOT NULL DEFAULT now(),
      note            text          NOT NULL DEFAULT '',
      on_behalf_of    varchar(40)   REFERENCES ${s}.users(id),
      late_days       integer,
      PRIMARY KEY (requisition_id, stage)
    )`);

  await q(`
    CREATE TABLE ${s}.requisition_payments (
      requisition_id  uuid           NOT NULL REFERENCES ${s}.requisitions(id),
      kind            varchar(10)    NOT NULL CHECK (kind IN ('advance', 'balance')),
      amount          numeric(14,2)  NOT NULL CHECK (amount > 0),
      mode            text           NOT NULL,
      ref             text           NOT NULL CHECK (length(trim(ref)) > 0),
      paid_by         varchar(40)    NOT NULL REFERENCES ${s}.users(id),
      paid_at         timestamptz    NOT NULL DEFAULT now(),
      PRIMARY KEY (requisition_id, kind)
    )`);

  await q(`
    CREATE TABLE ${s}.requisition_ref_sequences (
      year        integer      PRIMARY KEY,
      last_value  integer      NOT NULL,
      updated_at  timestamptz  NOT NULL DEFAULT now()
    )`);

  await q(`
    CREATE TABLE ${s}.settings (
      key         text           PRIMARY KEY,
      value       numeric(14,2)  NOT NULL CHECK (value >= 0),
      updated_by  varchar(40)    REFERENCES ${s}.users(id),
      updated_at  timestamptz    NOT NULL DEFAULT now()
    )`);

  /* Purchases recorded before M8 may name requisitions that only existed in a browser, so
     req_ref deliberately has no foreign key to requisitions.ref */
  await q(`
    ALTER TABLE ${s}.asset_procurements
      ADD COLUMN verified_by        varchar(40) REFERENCES ${s}.users(id),
      ADD COLUMN verified_at        timestamptz,
      ADD COLUMN verification_note  text`);
};

export const down: Migration = async ({ context: { schema, query: q } }) => {
  const s = `"${schema}"`;
  await q(`ALTER TABLE ${s}.asset_procurements DROP COLUMN verified_by, DROP COLUMN verified_at, DROP COLUMN verification_note`);
  await q(`DROP TABLE ${s}.settings, ${s}.requisition_ref_sequences, ${s}.requisition_payments, ${s}.requisition_approvals, ${s}.requisitions`);
};
