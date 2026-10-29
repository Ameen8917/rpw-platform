import { Op } from "sequelize";
import { Dealership, User } from "../org/org.models.js";
import { Session } from "./session.model.js";

/* Database access for sessions. Only this file touches the Session model. */
export const authRepository = {
  createSession: (s: { idHash: string; userId: string; expiresAt: Date; userAgent: string | null; ip: string | null }) =>
    Session.create(s),

  /* One query: session + user + the user's dealership IDs */
  findSessionWithUser: (idHash: string) =>
    Session.findByPk(idHash, {
      include: [{
        model: User, as: "user",
        include: [{ model: Dealership, as: "dealerships", attributes: ["id"], through: { attributes: [] } }],
      }],
    }),

  deleteSession: (idHash: string) => Session.destroy({ where: { idHash } }),

  deleteExpiredSessions: (now: Date) => Session.destroy({ where: { expiresAt: { [Op.lt]: now } } }),
};

export type AuthRepository = typeof authRepository;
