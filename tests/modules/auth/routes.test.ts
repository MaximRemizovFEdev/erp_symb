import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildApp } from "../../../src/app.js";
import { createCollectionRepository } from "../../../src/storage/index.js";

const passwordHash = "pbkdf2$sha256$120000$dev_admin_salt_v1$F3Za9oi1nlhtBQnYH3IWujaQtIoRSLNCKUp0SuTDTto";

async function createAppWithAdmin(): Promise<{ app: ReturnType<typeof buildApp>; dataDir: string }> {
  const dataDir = await mkdtemp(join(tmpdir(), "erp-symb-auth-routes-"));
  const users = createCollectionRepository("users", dataDir);

  await users.insert({
    id: "user_admin_dev",
    username: "admin",
    role: "admin",
    passwordHash,
    active: true
  });

  return {
    app: buildApp({ dataDir }),
    dataDir
  };
}

test("auth routes login and return current user without passwordHash", async () => {
  const { app, dataDir } = await createAppWithAdmin();

  try {
    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        username: "admin",
        password: "admin123"
      }
    });

    assert.equal(loginResponse.statusCode, 200);
    const loginBody = loginResponse.json();
    assert.equal(typeof loginBody.token, "string");

    const meResponse = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        authorization: "Bearer " + loginBody.token
      }
    });

    assert.equal(meResponse.statusCode, 200);
    assert.equal(meResponse.json().username, "admin");
    assert.equal("passwordHash" in meResponse.json(), false);
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("auth routes reject invalid credentials", async () => {
  const { app, dataDir } = await createAppWithAdmin();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        username: "admin",
        password: "wrong"
      }
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error.code, "INVALID_CREDENTIALS");
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
