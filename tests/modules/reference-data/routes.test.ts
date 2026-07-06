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
  productionToken: string;
};

async function createTestApp(): Promise<TestApp> {
  const dataDir = await mkdtemp(join(tmpdir(), "erp-symb-reference-routes-"));
  const users = createCollectionRepository("users", dataDir);

  await users.insert({
    id: "user_admin_dev",
    username: "admin",
    role: "admin",
    passwordHash,
    active: true
  });
  await users.insert({
    id: "user_production_dev",
    username: "production",
    role: "production",
    passwordHash,
    active: true
  });

  const app = buildApp({ dataDir });
  const adminToken = await login(app, "admin");
  const productionToken = await login(app, "production");

  return { app, dataDir, adminToken, productionToken };
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

test("reference routes create, list, get and update employees for admin", async () => {
  const { app, dataDir, adminToken } = await createTestApp();

  try {
    const headers = { authorization: "Bearer " + adminToken };
    const createResponse = await app.inject({
      method: "POST",
      url: "/employees",
      headers,
      payload: {
        id: "employee_test",
        fullName: "Test Employee",
        active: true
      }
    });

    assert.equal(createResponse.statusCode, 201);
    assert.equal(createResponse.json().id, "employee_test");

    const listResponse = await app.inject({ method: "GET", url: "/employees", headers });
    assert.equal(listResponse.statusCode, 200);
    assert.deepEqual(listResponse.json(), [
      {
        id: "employee_test",
        fullName: "Test Employee",
        active: true
      }
    ]);

    const getResponse = await app.inject({ method: "GET", url: "/employees/employee_test", headers });
    assert.equal(getResponse.statusCode, 200);
    assert.equal(getResponse.json().fullName, "Test Employee");

    const updateResponse = await app.inject({
      method: "PATCH",
      url: "/employees/employee_test",
      headers,
      payload: {
        fullName: "Updated Employee"
      }
    });

    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.json().fullName, "Updated Employee");
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("reference routes reject invalid enum values", async () => {
  const { app, dataDir, adminToken } = await createTestApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/contractors",
      headers: { authorization: "Bearer " + adminToken },
      payload: {
        id: "contractor_bad",
        name: "Bad Contractor",
        type: "unknown"
      }
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, "VALIDATION_ERROR");
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("reference routes allow production reads but forbid writes", async () => {
  const { app, dataDir, productionToken } = await createTestApp();
  const headers = { authorization: "Bearer " + productionToken };

  try {
    const readResponse = await app.inject({ method: "GET", url: "/contractors", headers });
    assert.equal(readResponse.statusCode, 200);

    const writeResponse = await app.inject({
      method: "POST",
      url: "/contractors",
      headers,
      payload: {
        id: "contractor_forbidden",
        name: "Forbidden",
        type: "external"
      }
    });

    assert.equal(writeResponse.statusCode, 403);
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
