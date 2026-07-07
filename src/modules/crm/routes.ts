import type { FastifyInstance } from "fastify";
import { ZodError, type ZodTypeAny } from "zod";

import type { AuthHooks } from "../auth/index.js";
import { AppError } from "../../shared/errors.js";
import { sanitizeForRole } from "../../shared/sanitize.js";
import { createCollectionRepository, type CollectionRecord } from "../../storage/index.js";
import { withCompanyBalance, withCustomerBalance } from "./balances.js";
import {
  companyCreateSchema,
  companyUpdateSchema,
  customerCompanyLinkCreateSchema,
  customerCompanyLinkUpdateSchema,
  customerCreateSchema,
  customerUpdateSchema
} from "./schemas.js";
import type { CustomerCompanyLinkRecord, CustomerCompanyRecord, CustomerRecord } from "./types.js";

type RegisterCrmRoutesOptions = {
  dataDir?: string;
  authHooks: AuthHooks;
};

type RouteParams = {
  id: string;
};

const crmRoles = ["admin", "owner", "manager"] as const;

export function registerCrmRoutes(app: FastifyInstance, options: RegisterCrmRoutesOptions): void {
  const customers = createCollectionRepository<CustomerRecord>("customers", options.dataDir);
  const companies = createCollectionRepository<CustomerCompanyRecord>("customer-companies", options.dataDir);
  const links = createCollectionRepository<CustomerCompanyLinkRecord>("customer-company-links", options.dataDir);
  const routeOptions = { preHandler: options.authHooks.requireAnyRole(crmRoles) };

  app.get("/customers", routeOptions, async (request) => {
    const items = await Promise.all((await customers.findAll()).map((customer) => withCustomerBalance(customer, options)));

    return sanitizeForRole(items, request.currentUser?.role);
  });

  app.post("/customers", routeOptions, async (request, reply) => {
    const item = parseBody<CustomerRecord>(customerCreateSchema, request.body);
    const created = await customers.insert(item);

    void reply.code(201);

    return sanitizeForRole(await withCustomerBalance(created, options), request.currentUser?.role);
  });

  app.get<{ Params: RouteParams }>("/customers/:id", routeOptions, async (request) => {
    const customer = await customers.findById(request.params.id);

    if (!customer) {
      throw notFound("Customer not found");
    }

    return sanitizeForRole(await withCustomerBalance(customer, options), request.currentUser?.role);
  });

  app.patch<{ Params: RouteParams }>("/customers/:id", routeOptions, async (request) => {
    const patch = parseBody<Partial<CustomerRecord>>(customerUpdateSchema, request.body);
    const updated = await customers.update(request.params.id, patch);

    return sanitizeForRole(await withCustomerBalance(updated, options), request.currentUser?.role);
  });

  app.delete<{ Params: RouteParams }>("/customers/:id", routeOptions, async (request) => {
    const existingLinks = await links.findAll();

    if (existingLinks.some((link) => link.customerId === request.params.id)) {
      throw new AppError("Customer has linked companies", {
        code: "CUSTOMER_HAS_COMPANIES",
        statusCode: 409
      });
    }

    const deleted = await customers.deleteById(request.params.id);

    if (!deleted) {
      throw notFound("Customer not found");
    }

    return { status: "ok" };
  });

  app.get<{ Params: RouteParams }>("/customers/:id/companies", routeOptions, async (request) => {
    const customer = await customers.findById(request.params.id);

    if (!customer) {
      throw notFound("Customer not found");
    }

    const allLinks = await links.findAll();
    const companyIds = new Set(
      allLinks.filter((link) => link.customerId === request.params.id && link.active !== false).map((link) => link.companyId)
    );
    const linkedCompanies = (await companies.findAll()).filter((company) => companyIds.has(company.id));
    const withBalances = await Promise.all(linkedCompanies.map((company) => withCompanyBalance(company, options)));

    return sanitizeForRole(withBalances, request.currentUser?.role);
  });

  app.get("/customer-companies", routeOptions, async (request) => {
    const items = await Promise.all((await companies.findAll()).map((company) => withCompanyBalance(company, options)));

    return sanitizeForRole(items, request.currentUser?.role);
  });

  app.post("/customer-companies", routeOptions, async (request, reply) => {
    const item = parseBody<CustomerCompanyRecord>(companyCreateSchema, request.body);
    const created = await companies.insert(item);

    void reply.code(201);

    return sanitizeForRole(await withCompanyBalance(created, options), request.currentUser?.role);
  });

  app.get<{ Params: RouteParams }>("/customer-companies/:id", routeOptions, async (request) => {
    const company = await companies.findById(request.params.id);

    if (!company) {
      throw notFound("Company not found");
    }

    return sanitizeForRole(await withCompanyBalance(company, options), request.currentUser?.role);
  });

  app.patch<{ Params: RouteParams }>("/customer-companies/:id", routeOptions, async (request) => {
    const patch = parseBody<Partial<CustomerCompanyRecord>>(companyUpdateSchema, request.body);
    const updated = await companies.update(request.params.id, patch);

    return sanitizeForRole(await withCompanyBalance(updated, options), request.currentUser?.role);
  });

  app.delete<{ Params: RouteParams }>("/customer-companies/:id", routeOptions, async (request) => {
    const existingLinks = await links.findAll();

    if (existingLinks.some((link) => link.companyId === request.params.id)) {
      throw new AppError("Company is linked to customers", {
        code: "COMPANY_HAS_CUSTOMERS",
        statusCode: 409
      });
    }

    const deleted = await companies.deleteById(request.params.id);

    if (!deleted) {
      throw notFound("Company not found");
    }

    return { status: "ok" };
  });

  app.get("/customer-company-links", routeOptions, async (request) => {
    return sanitizeForRole(await links.findAll(), request.currentUser?.role);
  });

  app.post("/customer-company-links", routeOptions, async (request, reply) => {
    const item = parseBody<CustomerCompanyLinkRecord>(customerCompanyLinkCreateSchema, request.body);

    await assertCustomerAndCompanyExist(item.customerId, item.companyId);
    await assertNoDuplicateActiveLink(item.customerId, item.companyId);

    const created = await links.insert(item);

    void reply.code(201);

    return sanitizeForRole(created, request.currentUser?.role);
  });

  app.get<{ Params: RouteParams }>("/customer-company-links/:id", routeOptions, async (request) => {
    const link = await links.findById(request.params.id);

    if (!link) {
      throw notFound("Customer-company link not found");
    }

    return sanitizeForRole(link, request.currentUser?.role);
  });

  app.patch<{ Params: RouteParams }>("/customer-company-links/:id", routeOptions, async (request) => {
    const patch = parseBody<Partial<CustomerCompanyLinkRecord>>(customerCompanyLinkUpdateSchema, request.body);
    const current = await links.findById(request.params.id);

    if (!current) {
      throw notFound("Customer-company link not found");
    }

    const nextCustomerId = patch.customerId ?? current.customerId;
    const nextCompanyId = patch.companyId ?? current.companyId;

    await assertCustomerAndCompanyExist(nextCustomerId, nextCompanyId);

    if ((patch.customerId !== undefined || patch.companyId !== undefined) && patch.active !== false) {
      await assertNoDuplicateActiveLink(nextCustomerId, nextCompanyId, current.id);
    }

    const updated = await links.update(request.params.id, patch);

    return sanitizeForRole(updated, request.currentUser?.role);
  });

  app.delete<{ Params: RouteParams }>("/customer-company-links/:id", routeOptions, async (request) => {
    const deleted = await links.deleteById(request.params.id);

    if (!deleted) {
      throw notFound("Customer-company link not found");
    }

    return { status: "ok" };
  });

  async function assertCustomerAndCompanyExist(customerId: string, companyId: string): Promise<void> {
    const [customer, company] = await Promise.all([customers.findById(customerId), companies.findById(companyId)]);

    if (!customer) {
      throw new AppError("Customer not found", {
        code: "CUSTOMER_NOT_FOUND",
        statusCode: 400
      });
    }

    if (!company) {
      throw new AppError("Company not found", {
        code: "COMPANY_NOT_FOUND",
        statusCode: 400
      });
    }
  }

  async function assertNoDuplicateActiveLink(customerId: string, companyId: string, exceptId?: string): Promise<void> {
    const existingLinks = await links.findAll();
    const duplicate = existingLinks.some(
      (link) =>
        link.id !== exceptId &&
        link.active !== false &&
        link.customerId === customerId &&
        link.companyId === companyId
    );

    if (duplicate) {
      throw new AppError("Customer-company link already exists", {
        code: "CUSTOMER_COMPANY_LINK_EXISTS",
        statusCode: 409
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
