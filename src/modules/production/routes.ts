import type { FastifyInstance } from "fastify";
import { ZodError, type ZodTypeAny } from "zod";

import type { AuthHooks } from "../auth/index.js";
import type { OrderItemRecord, OrderRecord } from "../orders/index.js";
import { AppError } from "../../shared/errors.js";
import { sanitizeForRole } from "../../shared/sanitize.js";
import { createCollectionRepository } from "../../storage/index.js";
import { productionCommentUpdateSchema, productionStatusUpdateSchema } from "./schemas.js";

type RegisterProductionRoutesOptions = {
  dataDir?: string;
  authHooks: AuthHooks;
};

type ContractorParams = {
  contractorId: string;
};

type ItemParams = {
  id: string;
};

type ProductionStatusUpdateInput = {
  productionStatusId: string;
};

type ProductionCommentUpdateInput = {
  comment: string;
};

const productionRoles = ["production"] as const;

export function registerProductionRoutes(app: FastifyInstance, options: RegisterProductionRoutesOptions): void {
  const orders = createCollectionRepository<OrderRecord>("orders", options.dataDir);
  const orderItems = createCollectionRepository<OrderItemRecord>("order-items", options.dataDir);
  const contractors = createCollectionRepository("contractors", options.dataDir);
  const productionStatuses = createCollectionRepository("production-statuses", options.dataDir);
  const routeOptions = { preHandler: options.authHooks.requireAnyRole(productionRoles) };

  app.get<{ Params: ContractorParams }>("/production/:contractorId/items", routeOptions, async (request) => {
    await assertContractorExists(request.params.contractorId);

    const allOrders = await orders.findAll();
    const ordersById = new Map(allOrders.map((order) => [order.id, order]));
    const items = (await orderItems.findAll())
      .filter((item) => item.contractorId === request.params.contractorId)
      .map((item) => toProductionItem(item, ordersById.get(item.orderId)));

    return sanitizeForRole(items, request.currentUser?.role);
  });

  app.patch<{ Params: ItemParams }>("/production/items/:id/status", routeOptions, async (request) => {
    const body = parseBody<ProductionStatusUpdateInput>(productionStatusUpdateSchema, request.body);
    await assertProductionStatusExists(body.productionStatusId);

    const item = await orderItems.findById(request.params.id);

    if (!item) {
      throw notFound("Order item not found");
    }

    const updated = await orderItems.update(request.params.id, {
      productionStatusId: body.productionStatusId
    });

    return sanitizeForRole(toProductionItem(updated, await orders.findById(updated.orderId)), request.currentUser?.role);
  });

  app.patch<{ Params: ItemParams }>("/production/items/:id/comment", routeOptions, async (request) => {
    const body = parseBody<ProductionCommentUpdateInput>(productionCommentUpdateSchema, request.body);
    const item = await orderItems.findById(request.params.id);

    if (!item) {
      throw notFound("Order item not found");
    }

    const updated = await orderItems.update(request.params.id, {
      comment: body.comment
    });

    return sanitizeForRole(toProductionItem(updated, await orders.findById(updated.orderId)), request.currentUser?.role);
  });

  async function assertContractorExists(contractorId: string): Promise<void> {
    if (!(await contractors.findById(contractorId))) {
      throw new AppError("Contractor not found", {
        code: "CONTRACTOR_NOT_FOUND",
        statusCode: 404
      });
    }
  }

  async function assertProductionStatusExists(productionStatusId: string): Promise<void> {
    if (!(await productionStatuses.findById(productionStatusId))) {
      throw new AppError("Production status not found", {
        code: "PRODUCTION_STATUS_NOT_FOUND",
        statusCode: 400
      });
    }
  }
}

function toProductionItem(item: OrderItemRecord, order: OrderRecord | undefined): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: item.id,
    orderId: item.orderId,
    orderNumber: order?.orderNumber,
    customerId: order?.customerId,
    companyId: order?.companyId,
    name: item.name,
    quantity: item.quantity,
    contractorId: item.contractorId,
    productionStatusId: item.productionStatusId,
    officeStatusId: item.officeStatusId,
    comment: item.comment
  };

  for (const key of Object.keys(result)) {
    if (result[key] === undefined) {
      delete result[key];
    }
  }

  return result;
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
