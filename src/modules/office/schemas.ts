import { z } from "zod";

const idSchema = z.string().trim().min(1).regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, underscore and dash");
const money = z.number().positive();
const optionalNonEmptyString = z.string().trim().min(1).optional();

export const officeOrderStatusUpdateSchema = z
  .object({
    officeStatusId: idSchema
  })
  .strict();

export const officeOrderItemStatusUpdateSchema = z
  .object({
    officeStatusId: idSchema
  })
  .strict();

export const officePaymentCreateSchema = z
  .object({
    id: idSchema.optional(),
    amount: money,
    method: optionalNonEmptyString,
    paidAt: z.string().datetime().optional(),
    comment: optionalNonEmptyString
  })
  .strict();
