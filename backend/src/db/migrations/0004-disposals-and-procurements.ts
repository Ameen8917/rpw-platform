import type { Migration } from "../migrator.js";

/* M5: disposals (one per asset, with the book value it was written off at) and procurements
   (one per requisition reference, so a purchase cannot be recorded twice). */
export const up: Migration = async ({ context: { schema, query: q } }) => {
  const s = `"${schema}"`;

  await q(`
    CREATE TABLE ${s}.asset_disposals (
      asset_id     uuid           PRIMARY KEY REFERENCES ${s}.assets(id) ON DELETE CASCADE,
      reason       text           NOT NULL CHECK (length(trim(reason)) > 0),
      scrap_value  numeric(14,2)  CHECK (scrap_value >= 0),
      book_value   numeric(14,2),
      disposed_by  varchar(40)    NOT NULL REFERENCES ${s}.users(id),
      disposed_at  timestamptz    NOT NULL DEFAULT now()
    )`);

  /* The requisition itself still lives in the browser (D4); this row records its purchase */
  await q(`
    CREATE TABLE ${s}.asset_procurements (
      req_ref        text           PRIMARY KEY,
      dealership_id  varchar(40)    NOT NULL REFERENCES ${s}.dealerships(id),
      vendor         text           NOT NULL,
      invoice_no     text           NOT NULL DEFAULT '',
      purchase_date  date           NOT NULL,
      total          numeric(14,2)  NOT NULL CHECK (total > 0),
      invoice_doc    jsonb,
      verified       boolean        NOT NULL,
      recorded_by    varchar(40)    NOT NULL REFERENCES ${s}.users(id),
      recorded_at    timestamptz    NOT NULL DEFAULT now()
    )`);
};

export const down: Migration = async ({ context: { schema, query: q } }) => {
  const s = `"${schema}"`;
  await q(`DROP TABLE ${s}.asset_procurements, ${s}.asset_disposals`);
};
