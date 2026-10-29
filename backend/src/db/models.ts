import type { Sequelize } from "sequelize";
import { initSessionModel } from "../modules/auth/session.model.js";
import { initOrgModels } from "../modules/org/org.models.js";

/* Registers every module's models on one Sequelize instance. Call once per instance, before use. */
export function initModels(sequelize: Sequelize) {
  initOrgModels(sequelize);
  initSessionModel(sequelize);
}
