import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { calculateCompanyBalance, calculateCustomerBalance } from "../../../src/modules/crm/index.js";
import { createCollectionRepository } from "../../../src/storage/index.js";

test("CRM balance helpers calculate customer and company balances from orders and payments", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "erp-symb-crm-balances-"));

  try {
    await createCollectionRepository("orders", dataDir).replaceAll([
      { id: "order_1", customerId: "customer_1", companyId: "company_1", orderSum: 150 },
      { id: "order_2", customerId: "customer_1", companyId: "company_2", orderSum: 20 },
      { id: "order_3", customerId: "customer_2", companyId: "company_1", orderSum: 30 }
    ]);
    await createCollectionRepository("order-payments", dataDir).replaceAll([
      { id: "payment_1", customerId: "customer_1", companyId: "company_1", amount: 40 }
    ]);
    await createCollectionRepository("payment-allocations", dataDir).replaceAll([
      { id: "allocation_1", orderId: "order_1", amount: 10 }
    ]);

    assert.equal(await calculateCustomerBalance("customer_1", { dataDir }), 120);
    assert.equal(await calculateCompanyBalance("company_1", { dataDir }), 130);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
