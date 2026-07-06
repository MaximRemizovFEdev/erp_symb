import { z } from "zod";

const idSchema = z.string().trim().min(1).regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, underscore and dash");
const nonEmptyString = z.string().trim().min(1);
const optionalNonEmptyString = nonEmptyString.optional();
const money = z.number().positive();

export const paymentCreateSchema = z
  .object({
    id: idSchema.optional(),
    customerId: idSchema.optional(),
    companyId: idSchema.optional(),
    amount: money,
    method: optionalNonEmptyString,
    paidAt: z.string().datetime().optional(),
    comment: optionalNonEmptyString
  })
  .strict()
  .refine((value) => value.customerId !== undefined || value.companyId !== undefined, "customerId or companyId is required");

export const paymentAllocationCreateSchema = z
  .object({
    id: idSchema.optional(),
    paymentId: idSchema,
    orderId: idSchema,
    amount: money
  })
  .strict();
