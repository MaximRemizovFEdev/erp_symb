import assert from "node:assert/strict";
import test from "node:test";

import { TokenService } from "../../../src/modules/auth/index.js";

test("TokenService signs and verifies auth users", () => {
  const service = new TokenService({ secret: "test-secret", ttlSeconds: 60 });
  const token = service.sign({ id: "user_1", username: "admin", role: "admin" });

  assert.deepEqual(service.verify(token), {
    id: "user_1",
    username: "admin",
    role: "admin"
  });
});

test("TokenService rejects tampered tokens", () => {
  const service = new TokenService({ secret: "test-secret", ttlSeconds: 60 });
  const token = service.sign({ id: "user_1", username: "admin", role: "admin" });
  const tamperedToken = token.replace(/.$/, "x");

  assert.throws(() => service.verify(tamperedToken), { name: "AppError" });
});
