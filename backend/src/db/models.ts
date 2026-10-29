import type { Sequelize } from "sequelize";
import { initAssetModels } from "../modules/assets/assets.models.js";
import { initAuditModels } from "../modules/audit/audit.models.js";
import { initFileModels } from "../modules/files/files.models.js";
import { initSessionModel } from "../modules/auth/session.model.js";
import { initOrgModels } from "../modules/org/org.models.js";

/* Registers every module's models on one Sequelize instance. Call once per instance, before use. */
export function initModels(sequelize: Sequelize) {
  initOrgModels(sequelize);
  initSessionModel(sequelize);
  initAuditModels(sequelize);
  initFileModels(sequelize);
  initAssetModels(sequelize);
}
