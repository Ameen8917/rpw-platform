import { fileURLToPath, pathToFileURL } from "node:url";
import type { QueryInterface, Sequelize } from "sequelize";
import { SequelizeStorage, Umzug } from "umzug";

export interface MigrationContext {
  queryInterface: QueryInterface;
  schema: string;
}
export type Migration = (params: { context: MigrationContext }) => Promise<void>;

const MIGRATIONS_DIR = fileURLToPath(new URL("./migrations", import.meta.url));

/* Migrations are files in db/migrations exporting `up` and `down`, applied in filename order.
   Applied names are recorded in <schema>.migrations. */
export function createMigrator(sequelize: Sequelize, schema: string) {
  return new Umzug<MigrationContext>({
    migrations: {
      glob: ["*.{ts,js}", { cwd: MIGRATIONS_DIR, ignore: ["*.d.ts", "*.test.ts", "*.map"] }],
      resolve: ({ name, path }) => ({
        name: name.replace(/\.(ts|js)$/, ""),
        up: async (params) => (await import(pathToFileURL(path!).href)).up(params),
        down: async (params) => (await import(pathToFileURL(path!).href)).down(params),
      }),
    },
    context: { queryInterface: sequelize.getQueryInterface(), schema },
    storage: new SequelizeStorage({ sequelize, schema, tableName: "migrations" }),
    logger: undefined,
  });
}
