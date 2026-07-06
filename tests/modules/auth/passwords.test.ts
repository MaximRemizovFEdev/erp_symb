import assert from "node:assert/strict";
import test from "node:test";

import { hashPassword, verifyPassword } from "../../../src/modules/auth/index.js";

test("password hashes verify the original password only", async () => {
  const passwordHash = await hashPassword("secret-password");

  assert.equal(passwordHash.includes("secret-password"), false);
  assert.equal(await verifyPassword("secret-password", passwordHash), true);
  assert.equal(await verifyPassword("wrong-password", passwordHash), false);
});
