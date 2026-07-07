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
  productionToken: string;
  managerToken: string;
};

async function createTestApp(): Promise<TestApp> {
  const dataDir = await mkdtemp(join(tmpdir(), "erp-symb-production-routes-"));

  await createCollectionRepository("users", dataDir).replaceAll([
    {
      id: "user_production_dev",
      username: "production",
      role: "production",
      passwordHash,
      active: true
    },
    {
      id: "user_manager_dev",
      username: "manager",
      role: "manager",
      passwordHash,
      active: true
    }
  ]);
  await createCollectionRepository("contractors", dataDir).replaceAll([
    { id: "contractor_internal", name: "Internal production", type: "internal", active: true },
    { id: "contractor_silk", name: "Silk screen", type: "production", active: true }
  ]);
  await createCollectionRepository("production-statuses", dataDir).replaceAll([
    { id: "production_pending", name: "Pending", sortOrder: 10, final: false },
    { id: "production_done", name: "Done", sortOrder: 20, final: true }
  ]);
  await createCollectionRepository("orders", dataDir).replaceAll([
    {
      id: "order_1",
      orderNumber: "SO-00001",
      customerId: "customer_1",
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
      id: "item_internal",
      orderId: "order_1",
      name: "Internal item",
      quantity: 2,
      pricePerUnit: 50,
      contractor1Cost: 10,
      contractorId: "contractor_internal",
      productionStatusId: "production_pending",
      officeStatusId: "office_not_ready",
      orderSum: 100,
      unitCost: 10,
      totalCost: 20,
      managerCommissionSum: 0,
      taxSum: 0,
      profitSum: 80,
      marginPercent: 80
    },
    {
      id: "item_silk",
      orderId: "order_1",
      name: "Silk item",
      quantity: 1,
      pricePerUnit: 20,
      contractorId: "contractor_silk",
      productionStatusId: "production_pending",
      officeStatusId: "office_not_ready",
      orderSum: 20,
      unitCost: 0,
      totalCost: 0,
      managerCommissionSum: 0,
      taxSum: 0,
      profitSum: 20,
      marginPercent: 100
    }
  ]);

  const app = buildApp({ dataDir });
  const productionToken = await login(app, "production");
  const managerToken = await login(app, "manager");

  return { app, dataDir, productionToken, managerToken };
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

test("production routes list contractor items without financial fields", async () => {
  const { app, dataDir, productionToken } = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/production/contractor_internal/items",
      headers: { authorization: "Bearer " + productionToken }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().length, 1);
    assert.equal(response.json()[0].id, "item_internal");
    assert.equal(response.json()[0].orderNumber, "SO-00001");
    assert.equal("pricePerUnit" in response.json()[0], false);
    assert.equal("totalCost" in response.json()[0], false);
    assert.equal("profitSum" in response.json()[0], false);
    assert.equal("paidAmount" in response.json()[0], false);
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("production routes allow status and comment updates only through dedicated endpoints", async () => {
  const { app, dataDir, productionToken } = await createTestApp();
  const headers = { authorization: "Bearer " + productionToken };

  try {
    const statusResponse = await app.inject({
      method: "PATCH",
      url: "/production/items/item_internal/status",
      headers,
      payload: {
        productionStatusId: "production_done"
      }
    });

    assert.equal(statusResponse.statusCode, 200);
    assert.equal(statusResponse.json().productionStatusId, "production_done");
    assert.equal("pricePerUnit" in statusResponse.json(), false);

    const commentResponse = await app.inject({
      method: "PATCH",
      url: "/production/items/item_internal/comment",
      headers,
      payload: {
        comment: "Ready for pickup"
      }
    });

    assert.equal(commentResponse.statusCode, 200);
    assert.equal(commentResponse.json().comment, "Ready for pickup");

    const item = await createCollectionRepository("order-items", dataDir).findById("item_internal");
    assert.equal(item?.productionStatusId, "production_done");
    assert.equal(item?.comment, "Ready for pickup");
    assert.equal(item?.pricePerUnit, 50);
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("production routes reject non-production role", async () => {
  const { app, dataDir, managerToken } = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/production/contractor_internal/items",
      headers: { authorization: "Bearer " + managerToken }
    });

    assert.equal(response.statusCode, 403);
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
