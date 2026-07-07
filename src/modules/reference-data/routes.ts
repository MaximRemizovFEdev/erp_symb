import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import { ZodError, type ZodTypeAny } from "zod";

import type { AuthHooks } from "../auth/index.js";
import { AppError } from "../../shared/errors.js";
import { sanitizeForRole } from "../../shared/sanitize.js";
import { createCollectionRepository, type CollectionRecord } from "../../storage/index.js";
import { referenceDefinitions, type ReferenceDefinition } from "./schemas.js";

type RegisterReferenceRoutesOptions = {
  dataDir?: string;
  authHooks?: AuthHooks;
};

type RouteParams = {
  id: string;
};

export function registerReferenceRoutes(
  app: FastifyInstance,
  options: RegisterReferenceRoutesOptions = {}
): void {
  for (const definition of referenceDefinitions) {
    registerReferenceCollectionRoutes(app, definition, options);
  }
}

function registerReferenceCollectionRoutes(
  app: FastifyInstance,
  definition: ReferenceDefinition,
  options: RegisterReferenceRoutesOptions
): void {
  const repository = createCollectionRepository(definition.collectionName, options.dataDir);
  const readPreHandler = options.authHooks?.requireAnyRole(definition.readRoles);
  const writePreHandler = options.authHooks?.requireAnyRole(definition.writeRoles);

  app.get(definition.path, routeOptions(readPreHandler), async (request) => {
    const items = await repository.findAll();

    return sanitizeForRole(items, request.currentUser?.role);
  });

  app.get<{ Params: RouteParams }>(definition.path + "/:id", routeOptions(readPreHandler), async (request) => {
    const item = await repository.findById(request.params.id);

    if (!item) {
      throw new AppError("Reference item not found", {
        code: "REFERENCE_ITEM_NOT_FOUND",
        statusCode: 404
      });
    }

    return sanitizeForRole(item, request.currentUser?.role);
  });

  app.post(definition.path, routeOptions(writePreHandler), async (request, reply) => {
    const item = parseBody<CollectionRecord>(definition.createSchema, request.body);
    const createdItem = await repository.insert(item);

    void reply.code(201);

    return sanitizeForRole(createdItem, request.currentUser?.role);
  });

  app.patch<{ Params: RouteParams }>(definition.path + "/:id", routeOptions(writePreHandler), async (request) => {
    const patch = parseBody<Partial<CollectionRecord>>(definition.updateSchema, request.body);
    const updatedItem = await repository.update(request.params.id, patch);

    return sanitizeForRole(updatedItem, request.currentUser?.role);
  });
}

function routeOptions(preHandler: preHandlerHookHandler | undefined): { preHandler?: preHandlerHookHandler } {
  return preHandler === undefined ? {} : { preHandler };
}

function parseBody<T>(schema: ZodTypeAny, body: unknown): T {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw validationError(result.error);
  }

  return result.data as T;
}

function validationError(error: ZodError): AppError {
  const message = error.issues.map((issue) => issue.path.join(".") + ": " + issue.message).join("; ");

  return new AppError(message || "Invalid request body", {
    code: "VALIDATION_ERROR",
    statusCode: 400
  });
}
