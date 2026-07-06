import assert from "node:assert/strict";
import test from "node:test";

import { calculateOrder, calculateOrderItem } from "../../src/services/calculations.js";
import { nextOrderNumber } from "../../src/services/orderNumber.js";

test("calculateOrderItem calculates item sums", () => {
  assert.deepEqual(
    calculateOrderItem({
      quantity: 2,
      pricePerUnit: 100,
      contractor1Cost: 20,
      contractor2Cost: 5,
      managerPercent: 10,
      taxPercent: 5
    }),
    {
      orderSum: 200,
      unitCost: 25,
      totalCost: 50,
      managerCommissionSum: 20,
      taxSum: 10,
      profitSum: 120,
      marginPercent: 60
    }
  );
});

test("calculateOrder aggregates item sums", () => {
  assert.deepEqual(
    calculateOrder({
      paidAmount: 30,
      items: [
        {
          orderSum: 200,
          unitCost: 25,
          totalCost: 50,
          managerCommissionSum: 20,
          taxSum: 10,
          profitSum: 120,
          marginPercent: 60
        }
      ]
    }),
    {
      orderSum: 200,
      itemsTotalCost: 50,
      itemsManagerCommissionSum: 20,
      itemsTaxSum: 10,
      profitSum: 120,
      paidAmount: 30,
      paymentDue: 170,
      officePaymentDue: 170,
      overpaidAmount: 0,
      marginPercent: 60
    }
  );
});

test("nextOrderNumber skips non-order numbers and increments max", () => {
  assert.equal(nextOrderNumber([{ id: "1", orderNumber: "SO-00009" }, { id: "2", orderNumber: "BAD" }]), "SO-00010");
});


test("calculateOrder tracks overpaid amount", () => {
  assert.deepEqual(
    calculateOrder({
      paidAmount: 230,
      items: [
        {
          orderSum: 200,
          unitCost: 25,
          totalCost: 50,
          managerCommissionSum: 20,
          taxSum: 10,
          profitSum: 120,
          marginPercent: 60
        }
      ]
    }),
    {
      orderSum: 200,
      itemsTotalCost: 50,
      itemsManagerCommissionSum: 20,
      itemsTaxSum: 10,
      profitSum: 120,
      paidAmount: 230,
      paymentDue: 0,
      officePaymentDue: 0,
      overpaidAmount: 30,
      marginPercent: 60
    }
  );
});
