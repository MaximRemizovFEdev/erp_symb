import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { ZodError, type ZodType } from "zod";

import type { AuthHooks, AuthUser } from "../auth/index.js";
import { AppError } from "../../shared/errors.js";
import { sanitizeForRole } from "../../shared/sanitize.js";
import { calculateOrder, calculateOrderItem, type OrderItemCalculationResult } from "../../services/calculations.js";
import { nextOrderNumber } from "../../services/orderNumber.js";
import { createCollectionRepository, type CollectionRecord } from "../../storage/index.js";
import { orderCreateSchema, orderItemCreateSchema, orderItemUpdateSchema, orderUpdateSchema } from "./schemas.js";
import type { OrderItemRecord, OrderRecord, OrderWithItems } from "./types.js";

type RegisterOrderRoutesOptions = {
  dataDir?: string;
  authHooks: AuthHooks;
};

type RouteParams = {
  id: string;
};

type OrderCreateInput = {
  id?: string;
  customerId: string;
  companyId?: string;
  orderStatusId?: string;
  officeStatusId?: string;
  comment?: string;
};

type OrderUpdateInput = Partial<Omit<OrderCreateInput, "id">>;

type OrderItemCreateInput = {
  id?: string;
  name: string;
  quantity: number;
  pricePerUnit: number;
  contractor1Cost?: number;
  contractor2Cost?: number;
  managerPercent?: number;
  taxPercent?: number;
  contractorId?: string;
  productionStatusId?: string;
  officeStatusId?: string;
  comment?: string;
};

type OrderItemUpdateInput = Partial<Omit<OrderItemCreateInput, "id">>;

const orderRoles = ["admin", "owner", "manager"] as const;
const defaultOrderStatusId = "order_new";
const defaultOfficeStatusId = "office_not_ready";
const defaultProductionStatusId = "production_pending";

export function registerOrderRoutes(app: FastifyInstance, options: RegisterOrderRoutesOptions): void {
  const orders = createCollectionRepository<OrderRecord>("orders", options.dataDir);
  const orderItems = createCollectionRepository<OrderItemRecord>("order-items", options.dataDir);
  const customers = createCollectionRepository("customers", options.dataDir);
  const companies = createCollectionRepository("customer-companies", options.dataDir);
  const links = createCollectionRepository("customer-company-links", options.dataDir);
  const statuses = createCollectionRepository("order-statuses", options.dataDir);
  const productionStatuses = createCollectionRepository("production-statuses", options.dataDir);
  const officeStatuses = createCollectionRepository("office-statuses", options.dataDir);
  const allocations = createCollectionRepository("payment-allocations", options.dataDir);
  const routeOptions = { preHandler: options.authHooks.requireAnyRole(orderRoles) };

  app.get("/orders", routeOptions, async (request) => {
    const visibleOrders = await visibleOrdersForCurrentUser(await orders.findAll(), request.currentUser);
    const result = await Promise.all(visibleOrders.map((order) => withItems(order)));

    return sanitizeForRole(result, request.currentUser?.role);
  });

  app.post("/orders", routeOptions, async (request, reply) => {
    const input = parseBody<OrderCreateInput>(orderCreateSchema, request.body);

    await assertOrderReferences(input.customerId, input.companyId, input.orderStatusId, input.officeStatusId);

    const existingOrders = await orders.findAll();
    const order: OrderRecord = {
      id: input.id ?? "order_" + randomUUID(),
      orderNumber: nextOrderNumber(existingOrders),
      customerId: input.customerId,
      orderStatusId: input.orderStatusId ?? defaultOrderStatusId,
      officeStatusId: input.officeStatusId ?? defaultOfficeStatusId,
      orderSum: 0,
      itemsTotalCost: 0,
      itemsManagerCommissionSum: 0,
      itemsTaxSum: 0,
      profitSum: 0,
      paidAmount: 0,
      paymentDue: 0,
      officePaymentDue: 0,
      marginPercent: 0
    };

    if (input.companyId !== undefined) {
      order.companyId = input.companyId;
    }
    if (request.currentUser?.employeeId !== undefined) {
      order.managerEmployeeId = request.currentUser.employeeId;
    }
    if (input.comment !== undefined) {
      order.comment = input.comment;
    }

    const created = await orders.insert(order);

    void reply.code(201);

    return sanitizeForRole(await withItems(created), request.currentUser?.role);
  });

  app.get<{ Params: RouteParams }>("/orders/:id", routeOptions, async (request) => {
    const order = await visibleOrderById(request.params.id, request.currentUser);

    return sanitizeForRole(await withItems(order), request.currentUser?.role);
  });

  app.patch<{ Params: RouteParams }>("/orders/:id", routeOptions, async (request) => {
    const current = await visibleOrderById(request.params.id, request.currentUser);
    const patch = parseBody<OrderUpdateInput>(orderUpdateSchema, request.body);
    const nextCustomerId = patch.customerId ?? current.customerId;
    const nextCompanyId = patch.companyId ?? current.companyId;

    await assertOrderReferences(nextCustomerId, nextCompanyId, patch.orderStatusId, patch.officeStatusId);

    const updated = await orders.update(request.params.id, patch);

    return sanitizeForRole(await withItems(updated), request.currentUser?.role);
  });

  app.post<{ Params: RouteParams }>("/orders/:id/items", routeOptions, async (request, reply) => {
    await visibleOrderById(request.params.id, request.currentUser);

    const input = parseBody<OrderItemCreateInput>(orderItemCreateSchema, request.body);
    await assertItemReferences(input.productionStatusId, input.officeStatusId);

    const created = await orderItems.insert(buildOrderItem(request.params.id, input));
    await recalculateOrder(request.params.id);

    void reply.code(201);

    return sanitizeForRole(created, request.currentUser?.role);
  });

  app.patch<{ Params: RouteParams }>("/order-items/:id", routeOptions, async (request) => {
    const current = await orderItems.findById(request.params.id);

    if (!current) {
      throw notFound("Order item not found");
    }

    await visibleOrderById(current.orderId, request.currentUser);

    const patch = parseBody<OrderItemUpdateInput>(orderItemUpdateSchema, request.body);
    await assertItemReferences(patch.productionStatusId, patch.officeStatusId);

    const mergedInput = { ...current, ...patch };
    const updated = await orderItems.update(request.params.id, buildOrderItem(current.orderId, mergedInput, current.id));
    await recalculateOrder(current.orderId);

    return sanitizeForRole(updated, request.currentUser?.role);
  });

  async function visibleOrdersForCurrentUser(allOrders: OrderRecord[], currentUser: AuthUser | undefined): Promise<OrderRecord[]> {
    return allOrders.filter((order) => isOrderVisible(order, currentUser));
  }

  async function visibleOrderById(orderId: string, currentUser: AuthUser | undefined): Promise<OrderRecord> {
    const order = await orders.findById(orderId);

    if (!order || !isOrderVisible(order, currentUser)) {
      throw notFound("Order not found");
    }

    return order;
  }

  function isOrderVisible(order: OrderRecord, currentUser: AuthUser | undefined): boolean {
    if (!currentUser) {
      return false;
    }

    if (currentUser.role === "admin" || currentUser.role === "owner") {
      return true;
    }

    return order.managerEmployeeId !== undefined && order.managerEmployeeId === currentUser.employeeId;
  }

  async function withItems(order: OrderRecord): Promise<OrderWithItems> {
    const items = (await orderItems.findAll()).filter((item) => item.orderId === order.id);

    return {
      ...order,
      items
    };
  }

  async function assertOrderReferences(
    customerId: string,
    companyId: string | undefined,
    orderStatusId: string | undefined,
    officeStatusId: string | undefined
  ): Promise<void> {
    if (!(await customers.findById(customerId))) {
      throw new AppError("Customer not found", {
        code: "CUSTOMER_NOT_FOUND",
        statusCode: 400
      });
    }

    if (companyId !== undefined) {
      if (!(await companies.findById(companyId))) {
        throw new AppError("Company not found", {
          code: "COMPANY_NOT_FOUND",
          statusCode: 400
        });
      }

      const customerLinks = await links.findAll();
      const linked = customerLinks.some(
        (link) => link.customerId === customerId && link.companyId === companyId && link.active !== false
      );

      if (!linked) {
        throw new AppError("Company is not linked to customer", {
          code: "COMPANY_NOT_LINKED_TO_CUSTOMER",
          statusCode: 400
        });
      }
    }

    if (orderStatusId !== undefined) {
      await assertStatusExists(statuses.findById(orderStatusId), "ORDER_STATUS_NOT_FOUND");
    }

    if (officeStatusId !== undefined) {
      await assertStatusExists(officeStatuses.findById(officeStatusId), "OFFICE_STATUS_NOT_FOUND");
    }
  }

  async function assertItemReferences(productionStatusId: string | undefined, officeStatusId: string | undefined): Promise<void> {
    if (productionStatusId !== undefined) {
      await assertStatusExists(productionStatuses.findById(productionStatusId), "PRODUCTION_STATUS_NOT_FOUND");
    }

    if (officeStatusId !== undefined) {
      await assertStatusExists(officeStatuses.findById(officeStatusId), "OFFICE_STATUS_NOT_FOUND");
    }
  }

  async function assertStatusExists(statusPromise: Promise<CollectionRecord | undefined>, code: string): Promise<void> {
    if (!(await statusPromise)) {
      throw new AppError("Status not found", {
        code,
        statusCode: 400
      });
    }
  }

  function buildOrderItem(orderId: string, input: OrderItemCreateInput, id = input.id ?? "order_item_" + randomUUID()): OrderItemRecord {
    const calculation = calculateOrderItem(input);
    const item: OrderItemRecord = {
      id,
      orderId,
      name: input.name,
      quantity: input.quantity,
      pricePerUnit: input.pricePerUnit,
      productionStatusId: input.productionStatusId ?? defaultProductionStatusId,
      officeStatusId: input.officeStatusId ?? defaultOfficeStatusId,
      ...calculation
    };

    copyOptionalNumber(item, "contractor1Cost", input.contractor1Cost);
    copyOptionalNumber(item, "contractor2Cost", input.contractor2Cost);
    copyOptionalNumber(item, "managerPercent", input.managerPercent);
    copyOptionalNumber(item, "taxPercent", input.taxPercent);

    if (input.contractorId !== undefined) {
      item.contractorId = input.contractorId;
    }
    if (input.comment !== undefined) {
      item.comment = input.comment;
    }

    return item;
  }

  async function recalculateOrder(orderId: string): Promise<OrderRecord> {
    const order = await orders.findById(orderId);

    if (!order) {
      throw notFound("Order not found");
    }

    const items = (await orderItems.findAll()).filter((item) => item.orderId === orderId);
    const orderPaidAmount = await calculatePaidAmount(orderId);
    const calculation = calculateOrder({
      items: items.map(toCalculationResult),
      paidAmount: orderPaidAmount
    });

    return orders.update(orderId, calculation);
  }

  async function calculatePaidAmount(orderId: string): Promise<number> {
    const currentAllocations = await allocations.findAll();

    return currentAllocations.reduce((sum, allocation) => {
      if (allocation.orderId !== orderId || typeof allocation.amount !== "number") {
        return sum;
      }

      return sum + allocation.amount;
    }, 0);
  }
}

function copyOptionalNumber<T extends Record<string, unknown>>(target: T, key: string, value: number | undefined): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

function toCalculationResult(item: OrderItemRecord): OrderItemCalculationResult {
  return {
    orderSum: item.orderSum,
    unitCost: item.unitCost,
    totalCost: item.totalCost,
    managerCommissionSum: item.managerCommissionSum,
    taxSum: item.taxSum,
    profitSum: item.profitSum,
    marginPercent: item.marginPercent
  };
}

function parseBody<T extends CollectionRecord | Partial<CollectionRecord>>(schema: ZodType<T>, body: unknown): T {
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
