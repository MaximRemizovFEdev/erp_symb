import { createCollectionRepository, type CollectionName, type CollectionRecord } from "./collections.js";

const devAdminPasswordHash = process.env.DEV_ADMIN_PASSWORD_HASH ?? "pbkdf2$sha256$120000$dev_admin_salt_v1$F3Za9oi1nlhtBQnYH3IWujaQtIoRSLNCKUp0SuTDTto";

export const initialSeedData: Partial<Record<CollectionName, CollectionRecord[]>> = {
  users: [
    {
      id: "user_admin_dev",
      username: "admin",
      role: "admin",
      passwordHash: devAdminPasswordHash,
      employeeId: "employee_admin_dev",
      active: true
    }
  ],
  employees: [
    {
      id: "employee_admin_dev",
      fullName: "Development Admin",
      active: true
    }
  ],
  contractors: [
    {
      id: "contractor_internal",
      name: "Internal production",
      type: "internal",
      active: true
    },
    {
      id: "contractor_silk_screen",
      name: "Silk screen production",
      type: "production",
      active: true
    }
  ],
  "order-statuses": [
    { id: "order_new", name: "New", sortOrder: 10, final: false },
    { id: "order_in_progress", name: "In progress", sortOrder: 20, final: false },
    { id: "order_ready", name: "Ready", sortOrder: 30, final: false },
    { id: "order_completed", name: "Completed", sortOrder: 40, final: true },
    { id: "order_cancelled", name: "Cancelled", sortOrder: 50, final: true }
  ],
  "production-statuses": [
    { id: "production_pending", name: "Pending", sortOrder: 10, final: false },
    { id: "production_in_progress", name: "In progress", sortOrder: 20, final: false },
    { id: "production_done", name: "Done", sortOrder: 30, final: true },
    { id: "production_blocked", name: "Blocked", sortOrder: 40, final: false }
  ],
  "office-statuses": [
    { id: "office_not_ready", name: "Not ready", sortOrder: 10, final: false },
    { id: "office_ready", name: "Ready", sortOrder: 20, final: false },
    { id: "office_issued", name: "Issued", sortOrder: 30, final: true },
    { id: "office_cancelled", name: "Cancelled", sortOrder: 40, final: true }
  ]
};

export async function seedInitialData(dataDir?: string): Promise<void> {
  for (const [collectionName, items] of Object.entries(initialSeedData) as [CollectionName, CollectionRecord[]][]) {
    const repository = createCollectionRepository(collectionName, dataDir);
    await repository.upsertMany(items);
  }
}

if (import.meta.url === "file://" + process.argv[1]) {
  seedInitialData().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
