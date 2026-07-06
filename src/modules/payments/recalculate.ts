import { calculateOrder, type OrderItemCalculationResult } from "../../services/calculations.js";
import { AppError } from "../../shared/errors.js";
import { createCollectionRepository } from "../../storage/index.js";
import type { OrderItemRecord, OrderRecord } from "../orders/index.js";
import type { PaymentAllocationRecord, PaymentRecord } from "./types.js";

export type PaymentRecalculationContext = {
  dataDir?: string;
};

export async function recalculatePayment(paymentId: string, context: PaymentRecalculationContext = {}): Promise<PaymentRecord> {
  const payments = createCollectionRepository<PaymentRecord>("order-payments", context.dataDir);
  const allocations = createCollectionRepository<PaymentAllocationRecord>("payment-allocations", context.dataDir);
  const payment = await payments.findById(paymentId);

  if (!payment) {
    throw new AppError("Payment not found", {
      code: "PAYMENT_NOT_FOUND",
      statusCode: 404
    });
  }

  const allocatedAmount = (await allocations.findAll())
    .filter((allocation) => allocation.paymentId === paymentId)
    .reduce((sum, allocation) => sum + allocation.amount, 0);
  const unallocatedAmount = roundMoney(payment.amount - allocatedAmount);

  return payments.update(paymentId, {
    allocatedAmount: roundMoney(allocatedAmount),
    unallocatedAmount
  });
}

export async function recalculateOrderPayment(orderId: string, context: PaymentRecalculationContext = {}): Promise<OrderRecord> {
  const orders = createCollectionRepository<OrderRecord>("orders", context.dataDir);
  const orderItems = createCollectionRepository<OrderItemRecord>("order-items", context.dataDir);
  const allocations = createCollectionRepository<PaymentAllocationRecord>("payment-allocations", context.dataDir);
  const order = await orders.findById(orderId);

  if (!order) {
    throw new AppError("Order not found", {
      code: "ORDER_NOT_FOUND",
      statusCode: 404
    });
  }

  const items = (await orderItems.findAll()).filter((item) => item.orderId === orderId);
  const paidAmount = (await allocations.findAll())
    .filter((allocation) => allocation.orderId === orderId)
    .reduce((sum, allocation) => sum + allocation.amount, 0);
  const calculation = calculateOrder({
    items: items.map(toCalculationResult),
    paidAmount
  });

  return orders.update(orderId, calculation);
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

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
