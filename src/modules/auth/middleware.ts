import type { FastifyRequest, preHandlerHookHandler } from "fastify";

import { AppError } from "../../shared/errors.js";
import { type Role } from "./types.js";
import { TokenService } from "./tokens.js";

export type AuthHooks = {
  optionalAuth: preHandlerHookHandler;
  requireAuth: preHandlerHookHandler;
  requireRole: (role: Role) => preHandlerHookHandler;
  requireAnyRole: (roles: readonly Role[]) => preHandlerHookHandler;
};

export function createAuthHooks(tokenService: TokenService): AuthHooks {
  function authenticateRequest(request: FastifyRequest): void {
    const token = bearerToken(request.headers.authorization);

    if (!token) {
      return;
    }

    request.currentUser = tokenService.verify(token);
  }

  const optionalAuth: preHandlerHookHandler = async (request) => {
    authenticateRequest(request);
  };

  const requireAuth: preHandlerHookHandler = async (request) => {
    authenticateRequest(request);

    if (!request.currentUser) {
      throw new AppError("Authentication required", {
        code: "UNAUTHORIZED",
        statusCode: 401
      });
    }
  };

  function requireAnyRole(allowedRoles: readonly Role[]): preHandlerHookHandler {
    return async (request) => {
      authenticateRequest(request);

      if (!request.currentUser) {
        throw new AppError("Authentication required", {
          code: "UNAUTHORIZED",
          statusCode: 401
        });
      }

      if (!allowedRoles.includes(request.currentUser.role)) {
        throw new AppError("Forbidden", {
          code: "FORBIDDEN",
          statusCode: 403
        });
      }
    };
  }

  return {
    optionalAuth,
    requireAuth,
    requireRole: (role) => requireAnyRole([role]),
    requireAnyRole
  };
}

function bearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) {
    return undefined;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError("Invalid authorization header", {
      code: "UNAUTHORIZED",
      statusCode: 401
    });
  }

  return token;
}
