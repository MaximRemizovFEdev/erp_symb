import Fastify, { type FastifyInstance } from "fastify";

import { loadEnv } from "./config/env.js";
import { createAuthHooks, registerAuthRoutes, TokenService } from "./modules/auth/index.js";
import { registerCrmRoutes } from "./modules/crm/index.js";
import { registerOrderRoutes } from "./modules/orders/index.js";
import { registerReferenceRoutes } from "./modules/reference-data/index.js";
import { normalizeError, type ErrorResponse } from "./shared/errors.js";

export type BuildAppOptions = {
  dataDir?: string;
};

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const env = loadEnv();

  const app = Fastify({
    logger: {
      level: env.logLevel
    }
  });

  const tokenService = new TokenService({
    secret: env.authTokenSecret,
    ttlSeconds: env.authTokenTtlSeconds
  });
  const authHooks = createAuthHooks(tokenService);

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "erp-symb",
      environment: env.nodeEnv
    };
  });

  registerAuthRoutes(
    app,
    options.dataDir === undefined
      ? { authHooks, tokenService }
      : { dataDir: options.dataDir, authHooks, tokenService }
  );
  registerReferenceRoutes(
    app,
    options.dataDir === undefined ? { authHooks } : { dataDir: options.dataDir, authHooks }
  );
  registerCrmRoutes(app, options.dataDir === undefined ? { authHooks } : { dataDir: options.dataDir, authHooks });
  registerOrderRoutes(app, options.dataDir === undefined ? { authHooks } : { dataDir: options.dataDir, authHooks });

  app.setErrorHandler((error, request, reply) => {
    const appError = normalizeError(error);

    request.log.error(
      {
        err: error,
        code: appError.code,
        statusCode: appError.statusCode
      },
      "Request failed"
    );

    const response: ErrorResponse = {
      error: {
        code: appError.code,
        message: appError.message,
        statusCode: appError.statusCode
      }
    };

    void reply.status(appError.statusCode).send(response);
  });

  app.setNotFoundHandler((request, reply) => {
    const response: ErrorResponse = {
      error: {
        code: "NOT_FOUND",
        message: `Route ${request.method} ${request.url} not found`,
        statusCode: 404
      }
    };

    void reply.status(404).send(response);
  });

  return app;
}
