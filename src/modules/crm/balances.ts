import { createCollectionRepository, type CollectionRecord } from "../../storage/index.js";

export type BalanceContext = {
  dataDir?: string;
};

export async function calculateCustomerBalance(customerId: string, context: BalanceContext = {}): Promise<number> {
  const orders = await createCollectionRepository("orders", context.dataDir).findAll();
  const payments = await createCollectionRepository("order-payments", context.dataDir).findAll();
  const allocations = await createCollectionRepository("payment-allocations", context.dataDir).findAll();

  const customerOrders = orders.filter((order) => order.customerId === customerId);
  const orderIds = new Set(customerOrders.map((order) => order.id));
  const orderTotal = sumAmounts(customerOrders, ["orderSum", "totalAmount", "amount"]);
  const allocatedPayments = sumAmounts(allocations.filter((allocation) => orderIds.has(String(allocation.orderId))), ["amount"]);
  const unallocatedPayments = sumAmounts(
    payments.filter((payment) => payment.customerId === customerId),
    ["unallocatedAmount"]
  );

  return roundMoney(orderTotal - allocatedPayments - unallocatedPayments);
}

export async function calculateCompanyBalance(companyId: string, context: BalanceContext = {}): Promise<number> {
  const orders = await createCollectionRepository("orders", context.dataDir).findAll();
  const payments = await createCollectionRepository("order-payments", context.dataDir).findAll();
  const allocations = await createCollectionRepository("payment-allocations", context.dataDir).findAll();

  const companyOrders = orders.filter((order) => order.companyId === companyId);
  const orderIds = new Set(companyOrders.map((order) => order.id));
  const orderTotal = sumAmounts(companyOrders, ["orderSum", "totalAmount", "amount"]);
  const allocatedPayments = sumAmounts(allocations.filter((allocation) => orderIds.has(String(allocation.orderId))), ["amount"]);
  const unallocatedPayments = sumAmounts(
    payments.filter((payment) => payment.companyId === companyId),
    ["unallocatedAmount"]
  );

  return roundMoney(orderTotal - allocatedPayments - unallocatedPayments);
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
