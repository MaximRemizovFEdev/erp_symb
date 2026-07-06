import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { AppError } from "../shared/errors.js";

export type CollectionFile<T> = {
  version: 1;
  items: T[];
};

export class JsonStoreError extends AppError {
  constructor(message: string, options: { code?: string; statusCode?: number } = {}) {
    super(message, {
      code: options.code ?? "JSON_STORE_ERROR",
      statusCode: options.statusCode ?? 500
    });
    this.name = "JsonStoreError";
  }
}

export type JsonStoreFileSystem = {
  mkdir: typeof mkdir;
  readFile: typeof readFile;
  rename: typeof rename;
  unlink: typeof unlink;
  writeFile: typeof writeFile;
};

export type JsonStoreOptions = {
  filePath: string;
  fileSystem?: Partial<JsonStoreFileSystem>;
};

const defaultFileSystem: JsonStoreFileSystem = {
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile
};

function createFileSystem(overrides: Partial<JsonStoreFileSystem> | undefined): JsonStoreFileSystem {
  return {
    mkdir: overrides?.mkdir ?? defaultFileSystem.mkdir,
    readFile: overrides?.readFile ?? defaultFileSystem.readFile,
    rename: overrides?.rename ?? defaultFileSystem.rename,
    unlink: overrides?.unlink ?? defaultFileSystem.unlink,
    writeFile: overrides?.writeFile ?? defaultFileSystem.writeFile
  };
}

export class JsonStore<T> {
  private static readonly writeQueues = new Map<string, Promise<void>>();

  private readonly filePath: string;
  private readonly fileSystem: JsonStoreFileSystem;

  constructor(options: JsonStoreOptions) {
    this.filePath = resolve(options.filePath);
    this.fileSystem = createFileSystem(options.fileSystem);
  }

  async read(): Promise<T[]> {
    await this.waitForPendingWrite();
    return this.readUnlocked();
  }

  async write(items: T[]): Promise<void> {
    await this.withWriteLock(async () => {
      await this.writeUnlocked(items);
    });
  }

  async update(mutator: (items: T[]) => T[] | Promise<T[]>): Promise<T[]> {
    return this.withWriteLock(async () => {
      const currentItems = await this.readUnlocked();
      const nextItems = await mutator([...currentItems]);

      await this.writeUnlocked(nextItems);

      return nextItems;
    });
  }

  private async readUnlocked(): Promise<T[]> {
    await this.ensureFile();

    let raw: string;

    try {
      raw = await this.fileSystem.readFile(this.filePath, "utf8");
    } catch (error) {
      throw new JsonStoreError("Failed to read JSON collection " + this.filePath, {
        code: "JSON_STORE_READ_FAILED"
      });
    }

    return this.parseCollection(raw).items;
  }

  private async writeUnlocked(items: T[]): Promise<void> {
    await this.fileSystem.mkdir(dirname(this.filePath), { recursive: true });

    const tempPath = this.filePath + "." + process.pid + "." + Date.now() + "." + randomUUID() + ".tmp";
    const payload = this.serializeCollection({ version: 1, items });

    try {
      await this.fileSystem.writeFile(tempPath, payload, "utf8");
      await this.fileSystem.rename(tempPath, this.filePath);
    } catch (error) {
      await this.removeTempFile(tempPath);
      throw new JsonStoreError("Failed to write JSON collection " + this.filePath, {
        code: "JSON_STORE_WRITE_FAILED"
      });
    }
  }

  private async ensureFile(): Promise<void> {
    try {
      await this.fileSystem.readFile(this.filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }

      await this.fileSystem.mkdir(dirname(this.filePath), { recursive: true });
      await this.fileSystem.writeFile(this.filePath, this.serializeCollection({ version: 1, items: [] }), "utf8");
    }
  }

  private parseCollection(raw: string): CollectionFile<T> {
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new JsonStoreError("Invalid JSON in collection " + this.filePath, {
        code: "JSON_STORE_INVALID_JSON"
      });
    }

    if (!this.isCollectionFile(parsed)) {
      throw new JsonStoreError("Invalid collection format in " + this.filePath, {
        code: "JSON_STORE_INVALID_FORMAT"
      });
    }

    return parsed;
  }

  private serializeCollection(collection: CollectionFile<T>): string {
    try {
      return JSON.stringify(collection, null, 2) + "\n";
    } catch (error) {
      throw new JsonStoreError("Failed to serialize JSON collection " + this.filePath, {
        code: "JSON_STORE_SERIALIZE_FAILED"
      });
    }
  }

  private isCollectionFile(value: unknown): value is CollectionFile<T> {
    if (!value || typeof value !== "object") {
      return false;
    }

    const collection = value as Partial<CollectionFile<T>>;

    return collection.version === 1 && Array.isArray(collection.items);
  }

  private async waitForPendingWrite(): Promise<void> {
    const pendingWrite = JsonStore.writeQueues.get(this.filePath);

    if (pendingWrite) {
      await pendingWrite;
    }
  }

  private async withWriteLock<Result>(operation: () => Promise<Result>): Promise<Result> {
    const previousWrite = JsonStore.writeQueues.get(this.filePath) ?? Promise.resolve();

    const currentWrite = previousWrite.catch(() => undefined).then(operation);
    JsonStore.writeQueues.set(
      this.filePath,
      currentWrite.then(
        () => undefined,
        () => undefined
      )
    );

    return currentWrite;
  }

  private async removeTempFile(tempPath: string): Promise<void> {
    try {
      await this.fileSystem.unlink(tempPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

