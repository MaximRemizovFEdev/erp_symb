import { AppError } from "../../shared/errors.js";
import { JsonStore } from "../jsonStore.js";

export type Identifiable = {
  id: string;
};

export class RepositoryError extends AppError {
  constructor(message: string, options: { code?: string; statusCode?: number } = {}) {
    super(message, {
      code: options.code ?? "REPOSITORY_ERROR",
      statusCode: options.statusCode ?? 500
    });
    this.name = "RepositoryError";
  }
}

export class JsonRepository<T extends Identifiable> {
  constructor(private readonly store: JsonStore<T>) {}

  async findAll(): Promise<T[]> {
    return this.store.read();
  }

  async findById(id: string): Promise<T | undefined> {
    const items = await this.store.read();

    return items.find((item) => item.id === id);
  }

  async replaceAll(items: T[]): Promise<T[]> {
    this.assertUniqueIds(items);
    await this.store.write(items);

    return items;
  }

  async insert(item: T): Promise<T> {
    await this.store.update((items) => {
      if (items.some((currentItem) => currentItem.id === item.id)) {
        throw new RepositoryError("Item " + item.id + " already exists", {
          code: "REPOSITORY_DUPLICATE_ID",
          statusCode: 409
        });
      }

      return [...items, item];
    });

    return item;
  }

  async update(id: string, patch: Partial<T> | ((item: T) => T)): Promise<T> {
    let updatedItem: T | undefined;

    await this.store.update((items) => {
      const itemIndex = items.findIndex((item) => item.id === id);

      if (itemIndex === -1) {
        throw new RepositoryError("Item " + id + " not found", {
          code: "REPOSITORY_NOT_FOUND",
          statusCode: 404
        });
      }

      const currentItem = items[itemIndex];

      if (!currentItem) {
        throw new RepositoryError("Item " + id + " not found", {
          code: "REPOSITORY_NOT_FOUND",
          statusCode: 404
        });
      }

      if (typeof patch !== "function" && patch.id !== undefined && patch.id !== id) {
        throw new RepositoryError("Item id cannot be changed", {
          code: "REPOSITORY_ID_CHANGE_FORBIDDEN",
          statusCode: 400
        });
      }

      const nextItem = typeof patch === "function" ? patch(currentItem) : { ...currentItem, ...patch, id };

      if (nextItem.id !== id) {
        throw new RepositoryError("Item id cannot be changed", {
          code: "REPOSITORY_ID_CHANGE_FORBIDDEN",
          statusCode: 400
        });
      }

      updatedItem = nextItem;

      const nextItems = [...items];
      nextItems[itemIndex] = nextItem;

      return nextItems;
    });

    if (!updatedItem) {
      throw new RepositoryError("Item " + id + " not found", {
        code: "REPOSITORY_NOT_FOUND",
        statusCode: 404
      });
    }

    return updatedItem;
  }

  async upsert(item: T): Promise<T> {
    await this.store.update((items) => {
      const itemIndex = items.findIndex((currentItem) => currentItem.id === item.id);

      if (itemIndex === -1) {
        return [...items, item];
      }

      const nextItems = [...items];
      nextItems[itemIndex] = item;

      return nextItems;
    });

    return item;
  }

  async upsertMany(itemsToUpsert: T[]): Promise<T[]> {
    this.assertUniqueIds(itemsToUpsert);

    await this.store.update((items) => {
      const byId = new Map(items.map((item) => [item.id, item]));

      for (const item of itemsToUpsert) {
        byId.set(item.id, item);
      }

      return [...byId.values()];
    });

    return itemsToUpsert;
  }

  async deleteById(id: string): Promise<boolean> {
    let deleted = false;

    await this.store.update((items) => {
      const nextItems = items.filter((item) => item.id !== id);
      deleted = nextItems.length !== items.length;

      return nextItems;
    });

    return deleted;
  }

  private assertUniqueIds(items: T[]): void {
    const ids = new Set<string>();

    for (const item of items) {
      if (ids.has(item.id)) {
        throw new RepositoryError("Duplicate item id " + item.id, {
          code: "REPOSITORY_DUPLICATE_ID",
          statusCode: 409
        });
      }

      ids.add(item.id);
    }
  }
}

export function createRepository<T extends Identifiable>(store: JsonStore<T>): JsonRepository<T> {
  return new JsonRepository(store);
}
