import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z, ZodError, type ZodTypeAny } from "zod";

import { hashPassword, roles, type AuthHooks, type Role, type UserRecord } from "../auth/index.js";
import { AppError } from "../../shared/errors.js";
import { sanitizeForRole } from "../../shared/sanitize.js";
import { createCollectionRepository } from "../../storage/index.js";

type RegisterAdminRoutesOptions = {
  dataDir?: string;
  authHooks: AuthHooks;
};

type RouteParams = {
  id: string;
};

type AdminUserCreateInput = {
  username: string;
  employeeId?: string;
  role: Role;
  password: string;
  active?: boolean;
};

type AdminUserUpdateInput = {
  username?: string;
  employeeId?: string;
  role?: Role;
  active?: boolean;
};

type PasswordResetInput = {
  password: string;
};

const adminRoles = ["admin", "owner"] as const;
const idSchema = z.string().trim().min(1).regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, underscore and dash");
const usernameSchema = z.string().trim().min(3).regex(/^[A-Za-z0-9_.@-]+$/, "Use only letters, numbers, dot, underscore, @ and dash");
const passwordSchema = z.string().min(8, "Password must contain at least 8 characters");

const userCreateSchema = z
  .object({
    username: usernameSchema,
    employeeId: idSchema.optional(),
    role: z.enum(roles),
    password: passwordSchema,
    active: z.boolean().optional()
  })
  .strict();

const userUpdateSchema = z
  .object({
    username: usernameSchema.optional(),
    employeeId: idSchema.optional(),
    role: z.enum(roles).optional(),
    active: z.boolean().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

const passwordResetSchema = z
  .object({
    password: passwordSchema
  })
  .strict();

export function registerAdminRoutes(app: FastifyInstance, options: RegisterAdminRoutesOptions): void {
  const users = createCollectionRepository<UserRecord>("users", options.dataDir);
  const employees = createCollectionRepository("employees", options.dataDir);
  const routeOptions = { preHandler: options.authHooks.requireAnyRole(adminRoles) };

  app.get("/admin/users", routeOptions, async (request) => {
    return sanitizeForRole(await users.findAll(), request.currentUser?.role);
  });

  app.post("/admin/users", routeOptions, async (request, reply) => {
    const input = parseBody<AdminUserCreateInput>(userCreateSchema, request.body);

    await assertUsernameAvailable(input.username);
    await assertEmployeeExists(input.employeeId);

    const user: UserRecord = {
      id: "user_" + randomUUID(),
      username: input.username,
      role: input.role,
      passwordHash: await hashPassword(input.password),
      active: input.active ?? true
    };

    if (input.employeeId !== undefined) {
      user.employeeId = input.employeeId;
    }

    const created = await users.insert(user);

    void reply.code(201);

    return sanitizeForRole(created, request.currentUser?.role);
  });

  app.patch<{ Params: RouteParams }>("/admin/users/:id", routeOptions, async (request) => {
    const patch = parseBody<AdminUserUpdateInput>(userUpdateSchema, request.body);

    if (patch.username !== undefined) {
      await assertUsernameAvailable(patch.username, request.params.id);
    }
    await assertEmployeeExists(patch.employeeId);

    const updated = await users.update(request.params.id, patch);

    return sanitizeForRole(updated, request.currentUser?.role);
  });

  app.post<{ Params: RouteParams }>("/admin/users/:id/password", routeOptions, async (request) => {
    const input = parseBody<PasswordResetInput>(passwordResetSchema, request.body);
    const existing = await users.findById(request.params.id);

    if (!existing) {
      throw notFound("User not found");
    }

    const updated = await users.update(request.params.id, {
      passwordHash: await hashPassword(input.password)
    });

    return sanitizeForRole(updated, request.currentUser?.role);
  });

  async function assertUsernameAvailable(username: string, exceptId?: string): Promise<void> {
    const duplicate = (await users.findAll()).some((user) => user.id !== exceptId && user.username === username);

    if (duplicate) {
      throw new AppError("Username already exists", {
        code: "USERNAME_ALREADY_EXISTS",
        statusCode: 409
      });
    }
  }

  async function assertEmployeeExists(employeeId: string | undefined): Promise<void> {
    if (employeeId !== undefined && !(await employees.findById(employeeId))) {
      throw new AppError("Employee not found", {
        code: "EMPLOYEE_NOT_FOUND",
        statusCode: 400
      });
    }
  }
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

function notFound(message: string): AppError {
  return new AppError(message, {
    code: "NOT_FOUND",
    statusCode: 404
  });
}
