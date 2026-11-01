import type { Transaction } from "sequelize";
import { Setting } from "./settings.models.js";

/* Database access for group settings. Only this file touches the Setting model. */
export const settingsRepository = {
  transaction: <T>(work: (t: Transaction) => Promise<T>) => Setting.sequelize!.transaction(work),

  all: (transaction?: Transaction) => Setting.findAll({ transaction }),

  save: (rows: { key: string; value: number; updatedBy: string | null }[], transaction: Transaction) =>
    Setting.bulkCreate(rows.map((r) => ({ ...r, updatedAt: new Date() })), {
      updateOnDuplicate: ["value", "updatedBy", "updatedAt"], transaction,
    }),
};

export type SettingsRepository = typeof settingsRepository;
