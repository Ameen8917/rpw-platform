import { fileURLToPath, pathToFileURL } from "node:url";
import type { QueryInterface, Sequelize, Transaction } from "sequelize";
import { SequelizeStorage, Umzug } from "umzug";

export interface MigrationContext {
  queryInterface: QueryInterface;
  schema: string;
  transaction: Transaction;
  /** Runs SQL inside this migration's transaction */
  query: (sql: string) => Promise<unknown>;
}
export type Migration = (params: { context: MigrationContext }) => Promise<void>;

const MIGRATIONS_DIR = fileURLToPath(new URL("./migrations", import.meta.url));

/* Migrations are files in db/migrations exporting `up` and `down`, applied in filename order.
   Each runs in its own transaction (Postgres DDL is transactional), so a failure leaves the
   schema as it was. Applied names are recorded in <schema>.migrations. */
export function createMigrator(sequelize: Sequelize, schema: string) {
  const inTransaction = (fn: Migration) =>
    sequelize.transaction((transaction) =>
      fn({
        context: {
          queryInterface: sequelize.getQueryInterface(),
          schema,
          transaction,
          query: (sql) => sequelize.query(sql, { transaction }),
        },
      }));

  return new Umzug({
    migrations: {
      glob: ["*.{ts,js}", { cwd: MIGRATIONS_DIR, ignore: ["*.d.ts", "*.test.ts", "*.map"] }],
      resolve: ({ name, path }) => {
        const load = async () => (await import(pathToFileURL(path!).href)) as { up: Migration; down: Migration };
        return {
          name: name.replace(/\.(ts|js)$/, ""),
          up: async () => inTransaction((await load()).up),
          down: async () => inTransaction((await load()).down),
        };
      },
    },
    context: {},
    storage: new SequelizeStorage({ sequelize, schema, tableName: "migrations" }),
    logger: undefined,
  });
}
