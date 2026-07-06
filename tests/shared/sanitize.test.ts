import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeForRole } from "../../src/shared/sanitize.js";

test("sanitizeForRole always hides passwordHash", () => {
  assert.deepEqual(sanitizeForRole({ id: "user_1", passwordHash: "secret" }, "admin"), { id: "user_1" });
});

test("sanitizeForRole hides financial fields from office and production", () => {
  const value = {
    id: "order_1",
    orderSum: 100,
    profitSum: 25,
    nested: {
      pricePerUnit: 50,
      name: "Item"
    }
  };

  assert.deepEqual(sanitizeForRole(value, "office"), {
    id: "order_1",
    nested: {
      name: "Item"
    }
  });
  assert.deepEqual(sanitizeForRole(value, "admin"), value);
});
