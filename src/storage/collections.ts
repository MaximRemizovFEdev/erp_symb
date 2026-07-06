import { resolve } from "node:path";

import { JsonStore } from "./jsonStore.js";
import { createRepository, type Identifiable, type JsonRepository } from "./repositories/index.js";

export const collectionNames = [
  "contractors",
  "order-statuses",
  "production-statuses",
  "office-statuses",
  "users",
  "employees",
  "customers",
  "customer-companies",
  "customer-company-links",
  "orders",
  "order-items",
  "order-payments",
  "payment-allocations",
  "audit-log"
] as const;

export type CollectionName = (typeof collectionNames)[number];
export type CollectionRecord = Identifiable & Record<string, unknown>;

export function collectionFilePath(collectionName: CollectionName, dataDir = resolve(process.cwd(), "data")): string {
  return resolve(dataDir, collectionName + ".json");
}

export function createCollectionRepository<T extends CollectionRecord = CollectionRecord>(
  collectionName: CollectionName,
  dataDir?: string
): JsonRepository<T> {
  return createRepository(new JsonStore<T>({ filePath: collectionFilePath(collectionName, dataDir) }));
}

export function createCollectionRepositories(
  dataDir?: string
): Record<CollectionName, JsonRepository<CollectionRecord>> {
  return Object.fromEntries(
    collectionNames.map((collectionName) => [collectionName, createCollectionRepository(collectionName, dataDir)])
  ) as Record<CollectionName, JsonRepository<CollectionRecord>>;
}
