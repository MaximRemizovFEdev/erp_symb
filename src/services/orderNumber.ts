import type { CollectionRecord } from "../storage/index.js";

const ORDER_NUMBER_PREFIX = "SO-";
const ORDER_NUMBER_WIDTH = 5;

export function nextOrderNumber(existingOrders: CollectionRecord[]): string {
  const maxNumber = existingOrders.reduce((max, order) => {
    const value = typeof order.orderNumber === "string" ? parseOrderNumber(order.orderNumber) : undefined;

    return value === undefined ? max : Math.max(max, value);
  }, 0);

  return ORDER_NUMBER_PREFIX + String(maxNumber + 1).padStart(ORDER_NUMBER_WIDTH, "0");
}

function parseOrderNumber(orderNumber: string): number | undefined {
  if (!orderNumber.startsWith(ORDER_NUMBER_PREFIX)) {
    return undefined;
  }

  const parsed = Number(orderNumber.slice(ORDER_NUMBER_PREFIX.length));

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
