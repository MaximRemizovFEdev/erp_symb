import { z } from "zod";

const idSchema = z.string().trim().min(1).regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, underscore and dash");
const nonEmptyString = z.string().trim().min(1);
const optionalNonEmptyString = nonEmptyString.optional();
const money = z.number().min(0);
const percent = z.number().min(0).max(100);

export const orderCreateSchema = z
  .object({
    id: idSchema.optional(),
    customerId: idSchema,
    companyId: idSchema.optional(),
    orderStatusId: idSchema.optional(),
    officeStatusId: idSchema.optional(),
    comment: optionalNonEmptyString
  })
  .strict();

export const orderUpdateSchema = z
  .object({
    customerId: idSchema.optional(),
    companyId: idSchema.optional(),
    orderStatusId: idSchema.optional(),
    officeStatusId: idSchema.optional(),
    comment: optionalNonEmptyString
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const orderItemCreateSchema = z
  .object({
    id: idSchema.optional(),
    name: nonEmptyString,
    quantity: z.number().positive(),
    pricePerUnit: money,
    contractor1Cost: money.optional(),
    contractor2Cost: money.optional(),
    managerPercent: percent.optional(),
    taxPercent: percent.optional(),
    contractorId: idSchema.optional(),
    productionStatusId: idSchema.optional(),
    officeStatusId: idSchema.optional(),
    comment: optionalNonEmptyString
  })
  .strict();

export const orderItemUpdateSchema = orderItemCreateSchema
  .omit({ id: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");
