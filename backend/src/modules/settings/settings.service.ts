import { HttpError } from "../../lib/http-error.js";
import { auditRepository, type AuditRepository } from "../audit/audit.repository.js";
import type { AuthContext } from "../auth/auth.service.js";
import { inrFull } from "../assets/asset-rules.js";
import { settingsRepository, type SettingsRepository } from "./settings.repository.js";
import { LIMIT_DEFAULTS, LIMIT_KEYS, type Limits, type SettingsInput } from "./settings.schemas.js";

export interface SettingsServiceOptions {
  repo?: SettingsRepository;
  auditRepo?: AuditRepository;
}

const inrShort = (n: number) => (n >= 100000 ? `₹${+(n / 100000).toFixed(2)}L` : inrFull(n));

/* Group limits. Read on every rule check (one small query), so an Admin change applies at once. */
export function createSettingsService(opts: SettingsServiceOptions = {}) {
  const repo = opts.repo ?? settingsRepository;
  const auditRepo = opts.auditRepo ?? auditRepository;

  async function limits(): Promise<Limits> {
    const out = { ...LIMIT_DEFAULTS };
    for (const row of await repo.all()) {
      if ((LIMIT_KEYS as string[]).includes(row.key)) out[row.key as keyof Limits] = Number(row.value);
    }
    return out;
  }

  return {
    limits,

    async update(auth: AuthContext, input: SettingsInput): Promise<Limits> {
      if (!auth.permissions.canAdminConsole) throw HttpError.forbidden();
      await repo.transaction(async (t) => {
        await repo.save(LIMIT_KEYS.map((key) => ({ key, value: input[key], updatedBy: auth.user.id })), t);
        await auditRepo.record({
          actorId: auth.user.id, action: "Updated authority rules", ref: "group",
          detail: `Purchase ${inrShort(input.purchaseDirector)} · advance ${inrShort(input.advanceEscalation)} · payment ${inrShort(input.directorPayment)}`
            + ` · floor ${inrShort(input.capitalisation)} · ${input.slaDays} days · ${input.variancePct}% overrun`,
        }, t);
      });
      return limits();
    },
  };
}

export type SettingsService = ReturnType<typeof createSettingsService>;
