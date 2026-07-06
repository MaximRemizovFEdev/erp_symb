import type { FastifyRequest } from "fastify";

import type { CollectionRecord } from "../../storage/index.js";

export const roles = ["admin", "owner", "manager", "office", "production"] as const;

export type Role = (typeof roles)[number];

export type UserRecord = CollectionRecord & {
  id: string;
  username: string;
  role: Role;
  passwordHash?: string;
  employeeId?: string;
  active?: boolean;
};

export type AuthUser = {
  id: string;
  username: string;
  role: Role;
  employeeId?: string;
};

export type AuthenticatedRequest = FastifyRequest & {
  currentUser: AuthUser;
};

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: AuthUser;
  }
}

export function isRole(value: string): value is Role {
  return (roles as readonly string[]).includes(value);
}

export function toAuthUser(user: UserRecord): AuthUser {
  const authUser: AuthUser = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  if (user.employeeId !== undefined) {
    authUser.employeeId = user.employeeId;
  }

  return authUser;
}
