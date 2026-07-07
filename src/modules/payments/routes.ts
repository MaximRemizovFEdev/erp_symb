import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { ZodError, type ZodTypeAny } from "zod";

import type { AuthHooks } from "../auth/index.js";
import type { OrderRecord } from "../orders/index.js";
import { AppError } from "../../shared/errors.js";
import { sanitizeForRole } from "../../shared/sanitize.js";
import { createCollectionRepository } from "../../storage/index.js";
import { recalculateOrderPayment, recalculatePayment } from "./recalculate.js";
import { paymentAllocationCreateSchema, paymentCreateSchema } from "./schemas.js";
import type { PaymentAllocationRecord, PaymentRecord } from "./types.js";

type RegisterPaymentRoutesOptions = {
  dataDir?: string;
  authHooks: AuthHooks;
};

type RouteParams = {
  id: string;
};

type PaymentCreateInput = {
  id?: string;
  customerId?: string;
  companyId?: string;
  amount: number;
  method?: string;
  paidAt?: string;
  comment?: string;
};

type PaymentAllocationCreateInput = {
  id?: string;
  paymentId: string;
  orderId: string;
  amount: number;
};

const paymentRoles = ["admin", "owner", "manager", "office"] as const;

export function registerPaymentRoutes(app: FastifyInstance, options: RegisterPaymentRoutesOptions): void {
  const payments = createCollectionRepository<PaymentRecord>("order-payments", options.dataDir);
  const allocations = createCollectionRepository<PaymentAllocationRecord>("payment-allocations", options.dataDir);
  const customers = createCollectionRepository("customers", options.dataDir);
  const companies = createCollectionRepository("customer-companies", options.dataDir);
  const links = createCollectionRepository("customer-company-links", options.dataDir);
  const orders = createCollectionRepository<OrderRecord>("orders", options.dataDir);
  const routeOptions = { preHandler: options.authHooks.requireAnyRole(paymentRoles) };

  app.get("/payments", routeOptions, async (request) => {
    return sanitizeForRole(await payments.findAll(), request.currentUser?.role);
  });

  app.post("/payments", routeOptions, async (request, reply) => {
    const input = parseBody<PaymentCreateInput>(paymentCreateSchema, request.body);
    await assertPaymentReferences(input.customerId, input.companyId);

    const payment: PaymentRecord = {
      id: input.id ?? "payment_" + randomUUID(),
      amount: input.amount,
      allocatedAmount: 0,
      unallocatedAmount: input.amount,
      paidAt: input.paidAt ?? new Date().toISOString()
    };

    if (input.customerId !== undefined) {
      payment.customerId = input.customerId;
    }
    if (input.companyId !== undefined) {
      payment.companyId = input.companyId;
    }
    if (input.method !== undefined) {
      payment.method = input.method;
    }
    if (input.comment !== undefined) {
      payment.comment = input.comment;
    }

    const created = await payments.insert(payment);

    void reply.code(201);

    return sanitizeForRole(created, request.currentUser?.role);
  });

  app.get("/payment-allocations", routeOptions, async (request) => {
    return sanitizeForRole(await allocations.findAll(), request.currentUser?.role);
  });

  app.post("/payment-allocations", routeOptions, async (request, reply) => {
    const input = parseBody<PaymentAllocationCreateInput>(paymentAllocationCreateSchema, request.body);
    const [payment, order] = await Promise.all([payments.findById(input.paymentId), orders.findById(input.orderId)]);

    if (!payment) {
      throw new AppError("Payment not found", {
        code: "PAYMENT_NOT_FOUND",
        statusCode: 400
      });
    }

    if (!order) {
      throw new AppError("Order not found", {
        code: "ORDER_NOT_FOUND",
        statusCode: 400
      });
    }

    assertPaymentCanBeAllocatedToOrder(payment, order);

    if (input.amount > payment.unallocatedAmount) {
      throw new AppError("Allocation exceeds unallocated payment amount", {
        code: "PAYMENT_ALLOCATION_EXCEEDS_UNALLOCATED_AMOUNT",
        statusCode: 400
      });
    }

    const allocation = await allocations.insert({
      id: input.id ?? "payment_allocation_" + randomUUID(),
      paymentId: input.paymentId,
      orderId: input.orderId,
      amount: input.amount
    });

    await Promise.all([
      recalculatePayment(input.paymentId, options),
      recalculateOrderPayment(input.orderId, options)
    ]);

    void reply.code(201);

    return sanitizeForRole(allocation, request.currentUser?.role);
  });

  app.delete<{ Params: RouteParams }>("/payment-allocations/:id", routeOptions, async (request) => {
    const allocation = await allocations.findById(request.params.id);

    if (!allocation) {
      throw new AppError("Payment allocation not found", {
        code: "PAYMENT_ALLOCATION_NOT_FOUND",
        statusCode: 404
      });
    }

    await allocations.deleteById(request.params.id);
    await Promise.all([
      recalculatePayment(allocation.paymentId, options),
      recalculateOrderPayment(allocation.orderId, options)
    ]);

    return { status: "ok" };
  });

  async function assertPaymentReferences(customerId: string | undefined, companyId: string | undefined): Promise<void> {
    if (customerId !== undefined && !(await customers.findById(customerId))) {
      throw new AppError("Customer not found", {
        code: "CUSTOMER_NOT_FOUND",
        statusCode: 400
      });
    }

    if (companyId !== undefined && !(await companies.findById(companyId))) {
      throw new AppError("Company not found", {
        code: "COMPANY_NOT_FOUND",
        statusCode: 400
      });
    }

    if (customerId !== undefined && companyId !== undefined) {
      const linked = (await links.findAll()).some(
        (link) => link.customerId === customerId && link.companyId === companyId && link.active !== false
      );

      if (!linked) {
        throw new AppError("Company is not linked to customer", {
          code: "COMPANY_NOT_LINKED_TO_CUSTOMER",
          statusCode: 400
        });
      }
    }
  }
}

function assertPaymentCanBeAllocatedToOrder(payment: PaymentRecord, order: OrderRecord): void {
  if (payment.customerId !== undefined && payment.customerId !== order.customerId) {
    throw new AppError("Payment customer does not match order customer", {
      code: "PAYMENT_CUSTOMER_MISMATCH",
      statusCode: 400
    });
  }

  if (payment.companyId !== undefined && payment.companyId !== order.companyId) {
    throw new AppError("Payment company does not match order company", {
      code: "PAYMENT_COMPANY_MISMATCH",
      statusCode: 400
    });
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
