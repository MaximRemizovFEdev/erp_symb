import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { ZodError, type ZodType } from "zod";

import type { AuthHooks } from "../auth/index.js";
import type { OrderItemRecord, OrderRecord } from "../orders/index.js";
import type { PaymentAllocationRecord, PaymentRecord } from "../payments/index.js";
import { recalculateOrderPayment, recalculatePayment } from "../payments/index.js";
import { AppError } from "../../shared/errors.js";
import { sanitizeForRole } from "../../shared/sanitize.js";
import { createCollectionRepository } from "../../storage/index.js";
import { officeOrderItemStatusUpdateSchema, officeOrderStatusUpdateSchema, officePaymentCreateSchema } from "./schemas.js";

type RegisterOfficeRoutesOptions = {
  dataDir?: string;
  authHooks: AuthHooks;
};

type RouteParams = {
  id: string;
};

type OfficeStatusUpdateInput = {
  officeStatusId: string;
};

type OfficePaymentCreateInput = {
  id?: string;
  amount: number;
  method?: string;
  paidAt?: string;
  comment?: string;
};

const officeRoles = ["admin", "owner", "office"] as const;

export function registerOfficeRoutes(app: FastifyInstance, options: RegisterOfficeRoutesOptions): void {
  const orders = createCollectionRepository<OrderRecord>("orders", options.dataDir);
  const orderItems = createCollectionRepository<OrderItemRecord>("order-items", options.dataDir);
  const officeStatuses = createCollectionRepository("office-statuses", options.dataDir);
  const payments = createCollectionRepository<PaymentRecord>("order-payments", options.dataDir);
  const allocations = createCollectionRepository<PaymentAllocationRecord>("payment-allocations", options.dataDir);
  const routeOptions = { preHandler: options.authHooks.requireAnyRole(officeRoles) };

  app.get("/office/orders", routeOptions, async (request) => {
    const allItems = await orderItems.findAll();
    const itemsByOrderId = groupItemsByOrderId(allItems);
    const result = (await orders.findAll()).map((order) => ({
      ...order,
      items: itemsByOrderId.get(order.id) ?? []
    }));

    return sanitizeForRole(result, request.currentUser?.role);
  });

  app.patch<{ Params: RouteParams }>("/office/orders/:id/status", routeOptions, async (request) => {
    const body = parseBody<OfficeStatusUpdateInput>(officeOrderStatusUpdateSchema, request.body);
    await assertOfficeStatusExists(body.officeStatusId);
    await assertOrderExists(request.params.id);

    const updatedOrder = await orders.update(request.params.id, {
      officeStatusId: body.officeStatusId
    });
    const items = (await orderItems.findAll()).filter((item) => item.orderId === request.params.id);

    await Promise.all(items.map((item) => orderItems.update(item.id, { officeStatusId: body.officeStatusId })));

    return sanitizeForRole(
      {
        ...updatedOrder,
        items: (await orderItems.findAll()).filter((item) => item.orderId === updatedOrder.id)
      },
      request.currentUser?.role
    );
  });

  app.patch<{ Params: RouteParams }>("/office/order-items/:id/status", routeOptions, async (request) => {
    const body = parseBody<OfficeStatusUpdateInput>(officeOrderItemStatusUpdateSchema, request.body);
    await assertOfficeStatusExists(body.officeStatusId);

    const item = await orderItems.findById(request.params.id);

    if (!item) {
      throw notFound("Order item not found");
    }

    const updatedItem = await orderItems.update(request.params.id, {
      officeStatusId: body.officeStatusId
    });
    await syncOrderOfficeStatusFromItems(item.orderId);

    return sanitizeForRole(updatedItem, request.currentUser?.role);
  });

  app.post<{ Params: RouteParams }>("/office/orders/:id/payments", routeOptions, async (request, reply) => {
    const input = parseBody<OfficePaymentCreateInput>(officePaymentCreateSchema, request.body);
    const order = await assertOrderExists(request.params.id);
    const payment: PaymentRecord = {
      id: input.id ?? "payment_" + randomUUID(),
      customerId: order.customerId,
      amount: input.amount,
      allocatedAmount: input.amount,
      unallocatedAmount: 0,
      paidAt: input.paidAt ?? new Date().toISOString()
    };

    if (order.companyId !== undefined) {
      payment.companyId = order.companyId;
    }
    if (input.method !== undefined) {
      payment.method = input.method;
    }
    if (input.comment !== undefined) {
      payment.comment = input.comment;
    }

    const createdPayment = await payments.insert(payment);
    const allocation = await allocations.insert({
      id: "payment_allocation_" + randomUUID(),
      paymentId: createdPayment.id,
      orderId: order.id,
      amount: input.amount
    });

    const [updatedPayment] = await Promise.all([
      recalculatePayment(createdPayment.id, options),
      recalculateOrderPayment(order.id, options)
    ]);

    void reply.code(201);

    return sanitizeForRole({ payment: updatedPayment, allocation }, request.currentUser?.role);
  });

  async function assertOrderExists(orderId: string): Promise<OrderRecord> {
    const order = await orders.findById(orderId);

    if (!order) {
      throw notFound("Order not found");
    }

    return order;
  }

  async function assertOfficeStatusExists(officeStatusId: string): Promise<void> {
    if (!(await officeStatuses.findById(officeStatusId))) {
      throw new AppError("Office status not found", {
        code: "OFFICE_STATUS_NOT_FOUND",
        statusCode: 400
      });
    }
  }

  async function syncOrderOfficeStatusFromItems(orderId: string): Promise<void> {
    const items = (await orderItems.findAll()).filter((item) => item.orderId === orderId);

    if (items.length === 0) {
      return;
    }

    const firstStatusId = items[0]?.officeStatusId;

    if (firstStatusId !== undefined && items.every((item) => item.officeStatusId === firstStatusId)) {
      await orders.update(orderId, {
        officeStatusId: firstStatusId
      });
    }
  }
}

function groupItemsByOrderId(items: OrderItemRecord[]): Map<string, OrderItemRecord[]> {
  const result = new Map<string, OrderItemRecord[]>();

  for (const item of items) {
    const currentItems = result.get(item.orderId) ?? [];
    currentItems.push(item);
    result.set(item.orderId, currentItems);
  }

  return result;
}

function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw validationError(result.error);
  }

  return result.data;
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
