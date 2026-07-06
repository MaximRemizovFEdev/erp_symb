import { createCollectionRepository, type CollectionRecord } from "../../storage/index.js";

export type BalanceContext = {
  dataDir?: string;
};

export async function calculateCustomerBalance(customerId: string, context: BalanceContext = {}): Promise<number> {
  const orders = await createCollectionRepository("orders", context.dataDir).findAll();
  const payments = await createCollectionRepository("order-payments", context.dataDir).findAll();
  const allocations = await createCollectionRepository("payment-allocations", context.dataDir).findAll();

  const orderIds = new Set(orders.filter((order) => order.customerId === customerId).map((order) => order.id));
  const orderTotal = sumAmounts(orders.filter((order) => order.customerId === customerId), ["orderSum", "totalAmount", "amount"]);
  const directPayments = sumAmounts(payments.filter((payment) => payment.customerId === customerId), ["amount", "paidAmount"]);
  const allocatedPayments = sumAmounts(allocations.filter((allocation) => orderIds.has(String(allocation.orderId))), ["amount"]);

  return roundMoney(orderTotal - directPayments - allocatedPayments);
}

export async function calculateCompanyBalance(companyId: string, context: BalanceContext = {}): Promise<number> {
  const orders = await createCollectionRepository("orders", context.dataDir).findAll();
  const payments = await createCollectionRepository("order-payments", context.dataDir).findAll();
  const allocations = await createCollectionRepository("payment-allocations", context.dataDir).findAll();

  const orderIds = new Set(orders.filter((order) => order.companyId === companyId).map((order) => order.id));
  const orderTotal = sumAmounts(orders.filter((order) => order.companyId === companyId), ["orderSum", "totalAmount", "amount"]);
  const directPayments = sumAmounts(payments.filter((payment) => payment.companyId === companyId), ["amount", "paidAmount"]);
  const allocatedPayments = sumAmounts(allocations.filter((allocation) => orderIds.has(String(allocation.orderId))), ["amount"]);

  return roundMoney(orderTotal - directPayments - allocatedPayments);
}

export async function withCustomerBalance<T extends CollectionRecord & { id: string }>(
  customer: T,
  context: BalanceContext = {}
): Promise<T & { balance: number }> {
  return {
    ...customer,
    balance: await calculateCustomerBalance(customer.id, context)
  };
}

export async function withCompanyBalance<T extends CollectionRecord & { id: string }>(
  company: T,
  context: BalanceContext = {}
): Promise<T & { balance: number }> {
  return {
    ...company,
    balance: await calculateCompanyBalance(company.id, context)
  };
}

function sumAmounts(items: CollectionRecord[], fields: string[]): number {
  return items.reduce((sum, item) => {
    for (const field of fields) {
      const value = item[field];

      if (typeof value === "number" && Number.isFinite(value)) {
        return sum + value;
      }
    }

    return sum;
  }, 0);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
