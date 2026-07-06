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
  managerToken: string;
};

async function createTestApp(): Promise<TestApp> {
  const dataDir = await mkdtemp(join(tmpdir(), "erp-symb-orders-routes-"));

  await createCollectionRepository("users", dataDir).insert({
    id: "user_manager_dev",
    username: "manager",
    role: "manager",
    employeeId: "employee_manager_dev",
    passwordHash,
    active: true
  });
  await createCollectionRepository("employees", dataDir).insert({
    id: "employee_manager_dev",
    fullName: "Manager Dev",
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
  await createCollectionRepository("order-statuses", dataDir).replaceAll([
    { id: "order_new", name: "New", sortOrder: 10, final: false }
  ]);
  await createCollectionRepository("office-statuses", dataDir).replaceAll([
    { id: "office_not_ready", name: "Not ready", sortOrder: 10, final: false },
    { id: "office_ready", name: "Ready", sortOrder: 20, final: false }
  ]);
  await createCollectionRepository("production-statuses", dataDir).replaceAll([
    { id: "production_pending", name: "Pending", sortOrder: 10, final: false }
  ]);

  const app = buildApp({ dataDir });
  const managerToken = await login(app);

  return { app, dataDir, managerToken };
}

async function login(app: ReturnType<typeof buildApp>): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      username: "manager",
      password: "admin123"
    }
  });

  assert.equal(response.statusCode, 200);

  return response.json().token;
}

test("orders routes create an order with number and manager assignment", async () => {
  const { app, dataDir, managerToken } = await createTestApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/orders",
      headers: { authorization: "Bearer " + managerToken },
      payload: {
        customerId: "customer_1",
        companyId: "company_1"
      }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().orderNumber, "SO-00001");
    assert.equal(response.json().managerEmployeeId, "employee_manager_dev");
    assert.deepEqual(response.json().items, []);
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("orders routes add and update items and recalculate order sums", async () => {
  const { app, dataDir, managerToken } = await createTestApp();
  const headers = { authorization: "Bearer " + managerToken };

  try {
    const orderResponse = await app.inject({
      method: "POST",
      url: "/orders",
      headers,
      payload: {
        id: "order_1",
        customerId: "customer_1",
        companyId: "company_1"
      }
    });

    assert.equal(orderResponse.statusCode, 201);

    const itemResponse = await app.inject({
      method: "POST",
      url: "/orders/order_1/items",
      headers,
      payload: {
        id: "item_1",
        name: "Banner",
        quantity: 2,
        pricePerUnit: 100,
        contractor1Cost: 20,
        contractor2Cost: 5,
        managerPercent: 10,
        taxPercent: 5
      }
    });

    assert.equal(itemResponse.statusCode, 201);
    assert.equal(itemResponse.json().profitSum, 120);

    const updatedItemResponse = await app.inject({
      method: "PATCH",
      url: "/order-items/item_1",
      headers,
      payload: {
        quantity: 3
      }
    });

    assert.equal(updatedItemResponse.statusCode, 200);
    assert.equal(updatedItemResponse.json().orderSum, 300);

    const getResponse = await app.inject({ method: "GET", url: "/orders/order_1", headers });

    assert.equal(getResponse.statusCode, 200);
    assert.equal(getResponse.json().orderSum, 300);
    assert.equal(getResponse.json().itemsTotalCost, 75);
    assert.equal(getResponse.json().profitSum, 180);
    assert.equal(getResponse.json().paymentDue, 300);
    assert.equal(getResponse.json().items.length, 1);
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("orders routes reject companies not linked to the customer", async () => {
  const { app, dataDir, managerToken } = await createTestApp();

  try {
    await createCollectionRepository("customer-companies", dataDir).insert({
      id: "company_2",
      name: "Other Company"
    });

    const response = await app.inject({
      method: "POST",
      url: "/orders",
      headers: { authorization: "Bearer " + managerToken },
      payload: {
        customerId: "customer_1",
        companyId: "company_2"
      }
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, "COMPANY_NOT_LINKED_TO_CUSTOMER");
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
