export type OrderItemCalculationInput = {
  quantity: number;
  pricePerUnit: number;
  contractor1Cost?: number;
  contractor2Cost?: number;
  managerPercent?: number;
  taxPercent?: number;
};

export type OrderItemCalculationResult = {
  orderSum: number;
  unitCost: number;
  totalCost: number;
  managerCommissionSum: number;
  taxSum: number;
  profitSum: number;
  marginPercent: number;
};

export type OrderCalculationInput = {
  items: OrderItemCalculationResult[];
  paidAmount?: number;
};

export type OrderCalculationResult = {
  orderSum: number;
  itemsTotalCost: number;
  itemsManagerCommissionSum: number;
  itemsTaxSum: number;
  profitSum: number;
  paidAmount: number;
  paymentDue: number;
  officePaymentDue: number;
  marginPercent: number;
};

export function calculateOrderItem(input: OrderItemCalculationInput): OrderItemCalculationResult {
  const quantity = input.quantity;
  const pricePerUnit = input.pricePerUnit;
  const contractor1Cost = input.contractor1Cost ?? 0;
  const contractor2Cost = input.contractor2Cost ?? 0;
  const managerPercent = input.managerPercent ?? 0;
  const taxPercent = input.taxPercent ?? 0;

  const orderSum = quantity * pricePerUnit;
  const unitCost = contractor1Cost + contractor2Cost;
  const totalCost = unitCost * quantity;
  const managerCommissionSum = orderSum * managerPercent / 100;
  const taxSum = orderSum * taxPercent / 100;
  const profitSum = orderSum - totalCost - managerCommissionSum - taxSum;
  const marginPercent = orderSum === 0 ? 0 : profitSum / orderSum * 100;

  return {
    orderSum: roundMoney(orderSum),
    unitCost: roundMoney(unitCost),
    totalCost: roundMoney(totalCost),
    managerCommissionSum: roundMoney(managerCommissionSum),
    taxSum: roundMoney(taxSum),
    profitSum: roundMoney(profitSum),
    marginPercent: roundPercent(marginPercent)
  };
}

export function calculateOrder(input: OrderCalculationInput): OrderCalculationResult {
  const orderSum = sum(input.items, "orderSum");
  const itemsTotalCost = sum(input.items, "totalCost");
  const itemsManagerCommissionSum = sum(input.items, "managerCommissionSum");
  const itemsTaxSum = sum(input.items, "taxSum");
  const profitSum = sum(input.items, "profitSum");
  const paidAmount = input.paidAmount ?? 0;
  const paymentDue = orderSum - paidAmount;
  const marginPercent = orderSum === 0 ? 0 : profitSum / orderSum * 100;

  return {
    orderSum: roundMoney(orderSum),
    itemsTotalCost: roundMoney(itemsTotalCost),
    itemsManagerCommissionSum: roundMoney(itemsManagerCommissionSum),
    itemsTaxSum: roundMoney(itemsTaxSum),
    profitSum: roundMoney(profitSum),
    paidAmount: roundMoney(paidAmount),
    paymentDue: roundMoney(paymentDue),
    officePaymentDue: roundMoney(paymentDue),
    marginPercent: roundPercent(marginPercent)
  };
}

function sum(items: OrderItemCalculationResult[], field: keyof OrderItemCalculationResult): number {
  return items.reduce((total, item) => total + item[field], 0);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}
