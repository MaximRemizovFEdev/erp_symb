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
  adminToken: string;
};

async function createTestApp(): Promise<TestApp> {
  const dataDir = await mkdtemp(join(tmpdir(), "erp-symb-payments-routes-"));

  await createCollectionRepository("users", dataDir).insert({
    id: "user_admin_dev",
    username: "admin",
    role: "admin",
    passwordHash,
    active: true
  });
  await createCollectionRepository("customers", dataDir).insert({
    id: "customer_1",
    fullName: "Test Customer"
  });
  await createCollectionRepository("customer-companies", dataDir).insert({
    id: "company_1",
    name: "Test Company"
  });
  await createCollectionRepository("customer-company-links", dataDir).insert({
    id: "link_1",
    customerId: "customer_1",
    companyId: "company_1"
  });
  await createCollectionRepository("orders", dataDir).insert({
    id: "order_1",
    orderNumber: "SO-00001",
    customerId: "customer_1",
    companyId: "company_1",
    orderStatusId: "order_new",
    officeStatusId: "office_not_ready",
    orderSum: 100,
    itemsTotalCost: 0,
    itemsManagerCommissionSum: 0,
    itemsTaxSum: 0,
    profitSum: 100,
    paidAmount: 0,
    paymentDue: 100,
    officePaymentDue: 100,
    overpaidAmount: 0,
    marginPercent: 100
  });
  await createCollectionRepository("order-items", dataDir).insert({
    id: "item_1",
    orderId: "order_1",
    name: "Banner",
    quantity: 1,
    pricePerUnit: 100,
    productionStatusId: "production_pending",
    officeStatusId: "office_not_ready",
    orderSum: 100,
    unitCost: 0,
    totalCost: 0,
    managerCommissionSum: 0,
    taxSum: 0,
    profitSum: 100,
    marginPercent: 100
  });

  const app = buildApp({ dataDir });
  const adminToken = await login(app);

  return { app, dataDir, adminToken };
}

async function login(app: ReturnType<typeof buildApp>): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      username: "admin",
      password: "admin123"
    }
  });

  assert.equal(response.statusCode, 200);

  return response.json().token;
}

test("payments routes create independent payment and allocate it to an order", async () => {
  const { app, dataDir, adminToken } = await createTestApp();
  const headers = { authorization: "Bearer " + adminToken };

  try {
    const paymentResponse = await app.inject({
      method: "POST",
      url: "/payments",
      headers,
      payload: {
        id: "payment_1",
        customerId: "customer_1",
        companyId: "company_1",
        amount: 120,
        paidAt: "2026-07-06T00:00:00.000Z"
      }
    });

    assert.equal(paymentResponse.statusCode, 201);
    assert.equal(paymentResponse.json().allocatedAmount, 0);
    assert.equal(paymentResponse.json().unallocatedAmount, 120);

    const allocationResponse = await app.inject({
      method: "POST",
      url: "/payment-allocations",
      headers,
      payload: {
        id: "allocation_1",
        paymentId: "payment_1",
        orderId: "order_1",
        amount: 110
      }
    });

    assert.equal(allocationResponse.statusCode, 201);

    const paymentsResponse = await app.inject({ method: "GET", url: "/payments", headers });
    assert.equal(paymentsResponse.statusCode, 200);
    assert.equal(paymentsResponse.json()[0].allocatedAmount, 110);
    assert.equal(paymentsResponse.json()[0].unallocatedAmount, 10);

    const order = await createCollectionRepository("orders", dataDir).findById("order_1");
    assert.equal(order?.paidAmount, 110);
    assert.equal(order?.paymentDue, 0);
    assert.equal(order?.overpaidAmount, 10);
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("payments routes reject allocation above unallocated amount", async () => {
  const { app, dataDir, adminToken } = await createTestApp();
  const headers = { authorization: "Bearer " + adminToken };

  try {
    await app.inject({
      method: "POST",
      url: "/payments",
      headers,
      payload: {
        id: "payment_1",
        customerId: "customer_1",
        amount: 50
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/payment-allocations",
      headers,
      payload: {
        paymentId: "payment_1",
        orderId: "order_1",
        amount: 60
      }
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, "PAYMENT_ALLOCATION_EXCEEDS_UNALLOCATED_AMOUNT");
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("payments routes delete allocations and restore unallocated amount", async () => {
  const { app, dataDir, adminToken } = await createTestApp();
  const headers = { authorization: "Bearer " + adminToken };

  try {
    await app.inject({
      method: "POST",
      url: "/payments",
      headers,
      payload: {
        id: "payment_1",
        customerId: "customer_1",
        amount: 70
      }
    });
    await app.inject({
      method: "POST",
      url: "/payment-allocations",
      headers,
      payload: {
        id: "allocation_1",
        paymentId: "payment_1",
        orderId: "order_1",
        amount: 70
      }
    });

    const response = await app.inject({ method: "DELETE", url: "/payment-allocations/allocation_1", headers });
    assert.equal(response.statusCode, 200);

    const payment = await createCollectionRepository("order-payments", dataDir).findById("payment_1");
    const order = await createCollectionRepository("orders", dataDir).findById("order_1");

    assert.equal(payment?.allocatedAmount, 0);
    assert.equal(payment?.unallocatedAmount, 70);
    assert.equal(order?.paidAmount, 0);
    assert.equal(order?.paymentDue, 100);
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
