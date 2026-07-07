import { z } from "zod";

import { roles, type Role } from "../auth/types.js";
import type { CollectionName, CollectionRecord } from "../../storage/index.js";

const allRoles = roles;
const writeRoles: readonly Role[] = ["admin", "owner"];
const idSchema = z.string().trim().min(1).regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, underscore and dash");
const nonEmptyString = z.string().trim().min(1);
const optionalNonEmptyString = nonEmptyString.optional();
const optionalEmail = z.string().trim().email().optional();
const activeFlag = z.boolean().optional();
const sortOrder = z.number().int().min(0);

const employeeSchema = z.object({
  id: idSchema,
  fullName: nonEmptyString,
  email: optionalEmail,
  phone: optionalNonEmptyString,
  active: activeFlag
});

const userSchema = z.object({
  id: idSchema,
  username: nonEmptyString,
  employeeId: optionalNonEmptyString,
  role: z.enum(roles),
  passwordHash: nonEmptyString,
  active: activeFlag
});

const contractorSchema = z.object({
  id: idSchema,
  name: nonEmptyString,
  type: z.enum(["internal", "production", "external"]),
  active: activeFlag
});

const statusSchema = z.object({
  id: idSchema,
  name: nonEmptyString,
  sortOrder,
  final: z.boolean().optional()
});

function updateSchemaFor(schema: z.AnyZodObject): z.ZodType<Partial<CollectionRecord>> {
  return schema
    .omit({ id: true })
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, "At least one field is required") as z.ZodType<
    Partial<CollectionRecord>
  >;
}

function createSchemaFor(schema: z.AnyZodObject): z.ZodType<CollectionRecord> {
  return schema.strict() as unknown as z.ZodType<CollectionRecord>;
}

export type ReferenceDefinition = {
  collectionName: CollectionName;
  path: string;
  createSchema: z.ZodType<CollectionRecord>;
  updateSchema: z.ZodType<Partial<CollectionRecord>>;
  readRoles: readonly Role[];
  writeRoles: readonly Role[];
};

export const referenceDefinitions = [
  {
    collectionName: "employees",
    path: "/employees",
    createSchema: createSchemaFor(employeeSchema),
    updateSchema: updateSchemaFor(employeeSchema),
    readRoles: allRoles,
    writeRoles
  },
  {
    collectionName: "users",
    path: "/users",
    createSchema: createSchemaFor(userSchema),
    updateSchema: updateSchemaFor(userSchema),
    readRoles: allRoles,
    writeRoles
  },
  {
    collectionName: "contractors",
    path: "/contractors",
    createSchema: createSchemaFor(contractorSchema),
    updateSchema: updateSchemaFor(contractorSchema),
    readRoles: allRoles,
    writeRoles
  },
  {
    collectionName: "order-statuses",
    path: "/order-statuses",
    createSchema: createSchemaFor(statusSchema),
    updateSchema: updateSchemaFor(statusSchema),
    readRoles: allRoles,
    writeRoles
  },
  {
    collectionName: "production-statuses",
    path: "/production-statuses",
    createSchema: createSchemaFor(statusSchema),
    updateSchema: updateSchemaFor(statusSchema),
    readRoles: allRoles,
    writeRoles
  },
  {
    collectionName: "office-statuses",
    path: "/office-statuses",
    createSchema: createSchemaFor(statusSchema),
    updateSchema: updateSchemaFor(statusSchema),
    readRoles: allRoles,
    writeRoles
  }
] satisfies ReferenceDefinition[];
