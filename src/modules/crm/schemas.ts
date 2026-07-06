import { z } from "zod";

const idSchema = z.string().trim().min(1).regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, underscore and dash");
const nonEmptyString = z.string().trim().min(1);
const optionalNonEmptyString = nonEmptyString.optional();
const optionalEmail = z.string().trim().email().optional();
const activeFlag = z.boolean().optional();

export const customerCreateSchema = z
  .object({
    id: idSchema,
    fullName: nonEmptyString,
    phone: optionalNonEmptyString,
    email: optionalEmail,
    comment: optionalNonEmptyString,
    active: activeFlag
  })
  .strict();

export const customerUpdateSchema = customerCreateSchema
  .omit({ id: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const companyCreateSchema = z
  .object({
    id: idSchema,
    name: nonEmptyString,
    inn: optionalNonEmptyString,
    kpp: optionalNonEmptyString,
    legalAddress: optionalNonEmptyString,
    comment: optionalNonEmptyString,
    active: activeFlag
  })
  .strict();

export const companyUpdateSchema = companyCreateSchema
  .omit({ id: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const customerCompanyLinkCreateSchema = z
  .object({
    id: idSchema,
    customerId: idSchema,
    companyId: idSchema,
    role: optionalNonEmptyString,
    active: activeFlag
  })
  .strict();

export const customerCompanyLinkUpdateSchema = customerCompanyLinkCreateSchema
  .omit({ id: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");
