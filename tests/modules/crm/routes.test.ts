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
  officeToken: string;
};

async function createTestApp(): Promise<TestApp> {
  const dataDir = await mkdtemp(join(tmpdir(), "erp-symb-crm-routes-"));
  const users = createCollectionRepository("users", dataDir);

  await users.insert({
    id: "user_admin_dev",
    username: "admin",
    role: "admin",
    passwordHash,
    active: true
  });
  await users.insert({
    id: "user_office_dev",
    username: "office",
    role: "office",
    passwordHash,
    active: true
  });

  const app = buildApp({ dataDir });
  const adminToken = await login(app, "admin");
  const officeToken = await login(app, "office");

  return { app, dataDir, adminToken, officeToken };
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

test("CRM routes create customers, companies and customer-company links", async () => {
  const { app, dataDir, adminToken } = await createTestApp();
  const headers = { authorization: "Bearer " + adminToken };

  try {
    const customerResponse = await app.inject({
      method: "POST",
      url: "/customers",
      headers,
      payload: {
        id: "customer_1",
        fullName: "Test Customer",
        phone: "+100000000"
      }
    });

    assert.equal(customerResponse.statusCode, 201);
    assert.equal(customerResponse.json().balance, 0);

    const companyResponse = await app.inject({
      method: "POST",
      url: "/customer-companies",
      headers,
      payload: {
        id: "company_1",
        name: "Test Company",
        inn: "1234567890"
      }
    });

    assert.equal(companyResponse.statusCode, 201);

    const linkResponse = await app.inject({
      method: "POST",
      url: "/customer-company-links",
      headers,
      payload: {
        id: "link_1",
        customerId: "customer_1",
        companyId: "company_1"
      }
    });

    assert.equal(linkResponse.statusCode, 201);

    const companiesResponse = await app.inject({
      method: "GET",
      url: "/customers/customer_1/companies",
      headers
    });

    assert.equal(companiesResponse.statusCode, 200);
    assert.deepEqual(companiesResponse.json(), [
      {
        id: "company_1",
        name: "Test Company",
        inn: "1234567890",
        balance: 0
      }
    ]);
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("CRM routes reject links to missing customers or companies", async () => {
  const { app, dataDir, adminToken } = await createTestApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/customer-company-links",
      headers: { authorization: "Bearer " + adminToken },
      payload: {
        id: "link_bad",
        customerId: "missing_customer",
        companyId: "missing_company"
      }
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, "CUSTOMER_NOT_FOUND");
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("CRM routes require CRM role", async () => {
  const { app, dataDir, officeToken } = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/customers",
      headers: { authorization: "Bearer " + officeToken }
    });

    assert.equal(response.statusCode, 403);
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
