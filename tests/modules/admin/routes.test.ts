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
  managerToken: string;
};

async function createTestApp(): Promise<TestApp> {
  const dataDir = await mkdtemp(join(tmpdir(), "erp-symb-admin-routes-"));
  const users = createCollectionRepository("users", dataDir);
  const employees = createCollectionRepository("employees", dataDir);

  await employees.insert({ id: "employee_admin", fullName: "Admin Employee", active: true });
  await employees.insert({ id: "employee_manager", fullName: "Manager Employee", active: true });
  await users.insert({
    id: "user_admin",
    username: "admin",
    role: "admin",
    employeeId: "employee_admin",
    passwordHash,
    active: true
  });
  await users.insert({
    id: "user_manager",
    username: "manager",
    role: "manager",
    employeeId: "employee_manager",
    passwordHash,
    active: true
  });

  const app = buildApp({ dataDir });
  const adminToken = await login(app, "admin", "admin123");
  const managerToken = await login(app, "manager", "admin123");

  return { app, dataDir, adminToken, managerToken };
}

async function login(app: ReturnType<typeof buildApp>, username: string, password: string): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { username, password }
  });

  assert.equal(response.statusCode, 200);

  return response.json().token;
}

test("admin routes create users with hashed passwords and allow login", async () => {
  const { app, dataDir, adminToken } = await createTestApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/admin/users",
      headers: { authorization: "Bearer " + adminToken },
      payload: {
        username: "office1",
        employeeId: "employee_manager",
        role: "office",
        password: "TempPass123",
        active: true
      }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().username, "office1");
    assert.equal(response.json().role, "office");
    assert.equal("passwordHash" in response.json(), false);

    const users = createCollectionRepository("users", dataDir);
    const created = (await users.findAll()).find((user) => user.username === "office1");
    assert.ok(created);
    assert.notEqual(created.passwordHash, "TempPass123");
    assert.match(created.passwordHash ?? "", /^pbkdf2\$/);

    const token = await login(app, "office1", "TempPass123");
    assert.equal(typeof token, "string");
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("admin routes reject duplicate usernames and non-admin writes", async () => {
  const { app, dataDir, adminToken, managerToken } = await createTestApp();

  try {
    const duplicate = await app.inject({
      method: "POST",
      url: "/admin/users",
      headers: { authorization: "Bearer " + adminToken },
      payload: {
        username: "manager",
        role: "manager",
        password: "TempPass123"
      }
    });

    assert.equal(duplicate.statusCode, 409);
    assert.equal(duplicate.json().error.code, "USERNAME_ALREADY_EXISTS");

    const forbidden = await app.inject({
      method: "POST",
      url: "/admin/users",
      headers: { authorization: "Bearer " + managerToken },
      payload: {
        username: "blocked",
        role: "office",
        password: "TempPass123"
      }
    });

    assert.equal(forbidden.statusCode, 403);
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("admin routes update users and reset passwords", async () => {
  const { app, dataDir, adminToken } = await createTestApp();

  try {
    const headers = { authorization: "Bearer " + adminToken };
    const update = await app.inject({
      method: "PATCH",
      url: "/admin/users/user_manager",
      headers,
      payload: {
        role: "office",
        active: false
      }
    });

    assert.equal(update.statusCode, 200);
    assert.equal(update.json().role, "office");
    assert.equal(update.json().active, false);
    assert.equal("passwordHash" in update.json(), false);

    const reset = await app.inject({
      method: "POST",
      url: "/admin/users/user_manager/password",
      headers,
      payload: {
        password: "NewPass123"
      }
    });

    assert.equal(reset.statusCode, 200);

    const users = createCollectionRepository("users", dataDir);
    await users.update("user_manager", { active: true });
    const token = await login(app, "manager", "NewPass123");
    assert.equal(typeof token, "string");
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
