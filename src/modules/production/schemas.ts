import { z } from "zod";

const idSchema = z.string().trim().min(1).regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, underscore and dash");
const nonEmptyString = z.string().trim().min(1);

export const productionStatusUpdateSchema = z
  .object({
    productionStatusId: idSchema
  })
  .strict();

export const productionCommentUpdateSchema = z
  .object({
    comment: nonEmptyString
  })
  .strict();
