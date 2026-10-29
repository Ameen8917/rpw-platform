import type { Migration } from "../migrator.js";

/* Organisation (dealership → facility → department), users and sign-in sessions.
   IDs are the prototype's readable text IDs (e.g. D_JCB_NSK), which the frontend already uses.
   Heads are deferred foreign keys: dealerships/departments and users reference each other,
   so seeding inserts both inside one transaction. */
export const up: Migration = async ({ context: { schema, query: q } }) => {
  const s = `"${schema}"`;

  await q(`
    CREATE TABLE ${s}.dealerships (
      id            varchar(40) PRIMARY KEY,
      short         varchar(5)  NOT NULL UNIQUE,
      name          text        NOT NULL,
      brand         text        NOT NULL,
      code          varchar(40) NOT NULL UNIQUE,
      head_id       varchar(40),
      territory     text[]      NOT NULL DEFAULT '{}',
      active        boolean     NOT NULL DEFAULT true,
      is_corporate  boolean     NOT NULL DEFAULT false,
      note          text,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    )`);

  await q(`
    CREATE TABLE ${s}.facilities (
      id             varchar(40) PRIMARY KEY,
      dealership_id  varchar(40) NOT NULL REFERENCES ${s}.dealerships(id),
      name           text        NOT NULL,
      type           text        NOT NULL CHECK (type IN ('3S facility', 'Sales outlet', 'Service outlet', 'Parts outlet', 'Corporate office')),
      district       text        NOT NULL,
      active         boolean     NOT NULL DEFAULT true,
      created_at     timestamptz NOT NULL DEFAULT now(),
      updated_at     timestamptz NOT NULL DEFAULT now()
    )`);
  await q(`CREATE INDEX facilities_dealership_idx ON ${s}.facilities (dealership_id)`);

  await q(`
    CREATE TABLE ${s}.departments (
      id                  varchar(40) PRIMARY KEY,
      name                text        NOT NULL UNIQUE,
      dual_authority      boolean     NOT NULL DEFAULT false,
      functional_head_id  varchar(40),
      active              boolean     NOT NULL DEFAULT true,
      created_at          timestamptz NOT NULL DEFAULT now(),
      updated_at          timestamptz NOT NULL DEFAULT now()
    )`);

  await q(`
    CREATE TABLE ${s}.users (
      id                   varchar(40)   PRIMARY KEY,
      emp_code             varchar(40)   NOT NULL UNIQUE,
      name                 text          NOT NULL,
      role                 varchar(30)   NOT NULL CHECK (role IN ('director', 'functional_head', 'business_head', 'manager', 'accounts_executive', 'staff')),
      title                text          NOT NULL,
      facility_id          varchar(40)   REFERENCES ${s}.facilities(id),
      dept_id              varchar(40)   REFERENCES ${s}.departments(id),
      can_login            boolean       NOT NULL DEFAULT true,
      inactive             boolean       NOT NULL DEFAULT false,
      approval_limit       numeric(14,2),
      grants               text[]        NOT NULL DEFAULT '{}',
      password_hash        text,
      password_changed_at  timestamptz,
      created_at           timestamptz   NOT NULL DEFAULT now(),
      updated_at           timestamptz   NOT NULL DEFAULT now(),
      CONSTRAINT users_no_password_without_login CHECK (can_login OR password_hash IS NULL)
    )`);

  await q(`
    CREATE TABLE ${s}.user_dealerships (
      user_id        varchar(40) NOT NULL REFERENCES ${s}.users(id) ON DELETE CASCADE,
      dealership_id  varchar(40) NOT NULL REFERENCES ${s}.dealerships(id),
      PRIMARY KEY (user_id, dealership_id)
    )`);
  await q(`CREATE INDEX user_dealerships_dealership_idx ON ${s}.user_dealerships (dealership_id)`);

  await q(`ALTER TABLE ${s}.dealerships ADD CONSTRAINT dealerships_head_fk
    FOREIGN KEY (head_id) REFERENCES ${s}.users(id) DEFERRABLE INITIALLY DEFERRED`);
  await q(`ALTER TABLE ${s}.departments ADD CONSTRAINT departments_functional_head_fk
    FOREIGN KEY (functional_head_id) REFERENCES ${s}.users(id) DEFERRABLE INITIALLY DEFERRED`);

  /* id_hash = HMAC-SHA256(SESSION_SECRET, cookie token); the token itself is never stored */
  await q(`
    CREATE TABLE ${s}.sessions (
      id_hash     char(64)    PRIMARY KEY,
      user_id     varchar(40) NOT NULL REFERENCES ${s}.users(id) ON DELETE CASCADE,
      expires_at  timestamptz NOT NULL,
      user_agent  text,
      ip          text,
      created_at  timestamptz NOT NULL DEFAULT now()
    )`);
  await q(`CREATE INDEX sessions_user_idx ON ${s}.sessions (user_id)`);
  await q(`CREATE INDEX sessions_expires_idx ON ${s}.sessions (expires_at)`);
};

export const down: Migration = async ({ context: { schema, query: q } }) => {
  const s = `"${schema}"`;
  await q(`DROP TABLE ${s}.sessions, ${s}.user_dealerships`);
  await q(`ALTER TABLE ${s}.dealerships DROP CONSTRAINT dealerships_head_fk`);
  await q(`ALTER TABLE ${s}.departments DROP CONSTRAINT departments_functional_head_fk`);
  await q(`DROP TABLE ${s}.users, ${s}.departments, ${s}.facilities, ${s}.dealerships`);
};
