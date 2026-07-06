import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { AppError } from "../../shared/errors.js";
import { sanitizeForRole } from "../../shared/sanitize.js";
import { createCollectionRepository } from "../../storage/index.js";
import type { AuthHooks } from "./middleware.js";
import { verifyPassword } from "./passwords.js";
import { TokenService } from "./tokens.js";
import { toAuthUser, type UserRecord } from "./types.js";

type RegisterAuthRoutesOptions = {
  dataDir?: string;
  authHooks: AuthHooks;
  tokenService: TokenService;
};

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1)
});

export function registerAuthRoutes(app: FastifyInstance, options: RegisterAuthRoutesOptions): void {
  const usersRepository = createCollectionRepository<UserRecord>("users", options.dataDir);

  app.post("/auth/login", async (request) => {
    const result = loginSchema.safeParse(request.body);

    if (!result.success) {
      throw invalidCredentials();
    }

    const users = await usersRepository.findAll();
    const user = users.find((item) => item.username === result.data.username && item.active !== false);

    if (!user || !(await verifyPassword(result.data.password, user.passwordHash))) {
      throw invalidCredentials();
    }

    const authUser = toAuthUser(user);

    return {
      token: options.tokenService.sign(authUser),
      user: sanitizeForRole(authUser, authUser.role)
    };
  });

  app.post("/auth/logout", { preHandler: options.authHooks.optionalAuth }, async () => {
    return {
      status: "ok"
    };
  });

  app.get("/auth/me", { preHandler: options.authHooks.requireAuth }, async (request) => {
    const currentUser = request.currentUser;

    if (!currentUser) {
      throw unauthorized();
    }

    const user = await usersRepository.findById(currentUser.id);

    if (!user || user.active === false) {
      throw unauthorized();
    }

    return sanitizeForRole(user, currentUser.role);
  });
}

function invalidCredentials(): AppError {
  return new AppError("Invalid credentials", {
    code: "INVALID_CREDENTIALS",
    statusCode: 401
  });
}

function unauthorized(): AppError {
  return new AppError("Authentication required", {
    code: "UNAUTHORIZED",
    statusCode: 401
  });
}
