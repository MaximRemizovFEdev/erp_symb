import type { Role } from "../modules/auth/types.js";

const sensitiveFields = new Set(["passwordHash"]);
const financialFields = new Set([
  "price",
  "pricePerUnit",
  "cost",
  "unitCost",
  "contractor1Cost",
  "contractor2Cost",
  "totalCost",
  "taxSum",
  "taxPercent",
  "profitSum",
  "marginPercent",
  "managerPercent",
  "managerCommissionSum",
  "orderSum",
  "paidAmount",
  "paymentDue",
  "officePaymentDue"
]);

export function sanitizeForRole<T>(value: T, role: Role | undefined): T {
  return sanitizeValue(value, role) as T;
}

function sanitizeValue(value: unknown, role: Role | undefined): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, role));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (sensitiveFields.has(key)) {
      continue;
    }

    if ((role === "office" || role === "production") && financialFields.has(key)) {
      continue;
    }

    sanitized[key] = sanitizeValue(nestedValue, role);
  }

  return sanitized;
}
