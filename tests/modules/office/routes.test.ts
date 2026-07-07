import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildApp } from "../../../src/app.js";
import { createCollectionRepository } from "../../../src/storage/index.js";

const passwordHash = "pbkdf2$sha256$120000$dev_admin_salt_v1$F3Za9oi1nlhtBQnYH3IWujaQtIoRSLNCKUp0SuTDTto";

type TestApp = {
  app: ReturnType<typeof buildApp>;
  dataDir: string;
  officeToken: string;
  productionToken: string;
};

async function createTestApp(): Promise<TestApp> {
  const dataDir = await mkdtemp(join(tmpdir(), "erp-symb-office-routes-"));

  await createCollectionRepository("users", dataDir).replaceAll([
    {
      id: "user_office_dev",
      username: "office",
      role: "office",
      passwordHash,
      active: true
    },
    {
      id: "user_production_dev",
      username: "production",
      role: "production",
      passwordHash,
      active: true
    }
  ]);
  await createCollectionRepository("office-statuses", dataDir).replaceAll([
    { id: "office_not_ready", name: "Not ready", sortOrder: 10, final: false },
    { id: "office_ready", name: "Ready", sortOrder: 20, final: false },
    { id: "office_issued", name: "Issued", sortOrder: 30, final: true }
  ]);
  await createCollectionRepository("orders", dataDir).replaceAll([
    {
      id: "order_1",
      orderNumber: "SO-00001",
      customerId: "customer_1",
      companyId: "company_1",
      orderStatusId: "order_new",
      officeStatusId: "office_not_ready",
      orderSum: 100,
      itemsTotalCost: 20,
      itemsManagerCommissionSum: 0,
      itemsTaxSum: 0,
      profitSum: 80,
      paidAmount: 0,
      paymentDue: 100,
      officePaymentDue: 100,
      overpaidAmount: 0,
      marginPercent: 80
    }
  ]);
  await createCollectionRepository("order-items", dataDir).replaceAll([
    {
      id: "item_1",
      orderId: "order_1",
      name: "Item 1",
      quantity: 1,
      pricePerUnit: 50,
      officeStatusId: "office_not_ready",
      productionStatusId: "production_done",
      orderSum: 50,
      unitCost: 10,
      totalCost: 10,
      managerCommissionSum: 0,
      taxSum: 0,
      profitSum: 40,
      marginPercent: 80
    },
    {
      id: "item_2",
      orderId: "order_1",
      name: "Item 2",
      quantity: 1,
      pricePerUnit: 50,
      officeStatusId: "office_not_ready",
      productionStatusId: "production_done",
      orderSum: 50,
      unitCost: 10,
      totalCost: 10,
      managerCommissionSum: 0,
      taxSum: 0,
      profitSum: 40,
      marginPercent: 80
    }
  ]);

  const app = buildApp({ dataDir });
  const officeToken = await login(app, "office");
  const productionToken = await login(app, "production");

  return { app, dataDir, officeToken, productionToken };
}

async function login(app: ReturnType<typeof buildApp>, username: string): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      username,
      password: "admin123"
    }
  });

  assert.equal(response.statusCode, 200);

  return response.json().token;
}

test("office routes list orders for pickup without financial fields", async () => {
  const { app, dataDir, officeToken } = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/office/orders",
      headers: { authorization: "Bearer " + officeToken }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().length, 1);
    assert.equal(response.json()[0].id, "order_1");
    assert.equal(response.json()[0].items.length, 2);
    assert.equal("orderSum" in response.json()[0], false);
    assert.equal("paidAmount" in response.json()[0], false);
    assert.equal("pricePerUnit" in response.json()[0].items[0], false);
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("office routes update order status and sync all item office statuses", async () => {
  const { app, dataDir, officeToken } = await createTestApp();

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/office/orders/order_1/status",
      headers: { authorization: "Bearer " + officeToken },
      payload: { officeStatusId: "office_ready" }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().officeStatusId, "office_ready");

    const items = await createCollectionRepository("order-items", dataDir).findAll();
    assert.equal(items.every((item) => item.officeStatusId === "office_ready"), true);
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("office routes sync order status when all items share the same office status", async () => {
  const { app, dataDir, officeToken } = await createTestApp();
  const headers = { authorization: "Bearer " + officeToken };

  try {
    const firstResponse = await app.inject({
      method: "PATCH",
      url: "/office/order-items/item_1/status",
      headers,
      payload: { officeStatusId: "office_ready" }
    });
    assert.equal(firstResponse.statusCode, 200);

    let order = await createCollectionRepository("orders", dataDir).findById("order_1");
    assert.equal(order?.officeStatusId, "office_not_ready");

    const secondResponse = await app.inject({
      method: "PATCH",
      url: "/office/order-items/item_2/status",
      headers,
      payload: { officeStatusId: "office_ready" }
    });
    assert.equal(secondResponse.statusCode, 200);

    order = await createCollectionRepository("orders", dataDir).findById("order_1");
    assert.equal(order?.officeStatusId, "office_ready");
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("office routes add payment allocated to the order", async () => {
  const { app, dataDir, officeToken } = await createTestApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/office/orders/order_1/payments",
      headers: { authorization: "Bearer " + officeToken },
      payload: {
        id: "payment_office_1",
        amount: 60,
        method: "cash",
        paidAt: "2026-07-07T00:00:00.000Z"
      }
    });

    assert.equal(response.statusCode, 201);
    assert.equal("amount" in response.json().payment, false);
    assert.equal("allocatedAmount" in response.json().payment, false);

    const payment = await createCollectionRepository("order-payments", dataDir).findById("payment_office_1");
    const allocations = await createCollectionRepository("payment-allocations", dataDir).findAll();
    const order = await createCollectionRepository("orders", dataDir).findById("order_1");

    assert.equal(payment?.allocatedAmount, 60);
    assert.equal(payment?.unallocatedAmount, 0);
    assert.equal(allocations[0]?.amount, 60);
    assert.equal(order?.paidAmount, 60);
    assert.equal(order?.paymentDue, 40);
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("office routes reject production role", async () => {
  const { app, dataDir, productionToken } = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/office/orders",
      headers: { authorization: "Bearer " + productionToken }
    });

    assert.equal(response.statusCode, 403);
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
