import type { CreationAttributes, Transaction } from "sequelize";
import { StoredFile } from "./files.models.js";

/* Database access for file records. Only this file touches the StoredFile model. */
export const filesRepository = {
  create: (f: CreationAttributes<StoredFile>, transaction?: Transaction) => StoredFile.create(f, { transaction }),
};

export type FilesRepository = typeof filesRepository;
