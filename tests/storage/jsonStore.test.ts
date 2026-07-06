import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { JsonStore } from "../../src/storage/jsonStore.js";

type TestRecord = {
  id: string;
  value?: number;
};

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "erp-symb-json-store-"));
}

test("JsonStore creates a missing collection file and reads empty items", async () => {
  const dir = await createTempDir();

  try {
    const filePath = join(dir, "items.json");
    const store = new JsonStore<TestRecord>({ filePath });

    const items = await store.read();
    const raw = JSON.parse(await readFile(filePath, "utf8"));

    assert.deepEqual(items, []);
    assert.deepEqual(raw, { version: 1, items: [] });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("JsonStore writes and reads collection items", async () => {
  const dir = await createTempDir();

  try {
    const store = new JsonStore<TestRecord>({ filePath: join(dir, "items.json") });

    await store.write([{ id: "item_1", value: 10 }]);

    assert.deepEqual(await store.read(), [{ id: "item_1", value: 10 }]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("JsonStore keeps the previous file and removes temp file when rename fails", async () => {
  const dir = await createTempDir();

  try {
    const filePath = join(dir, "items.json");
    const store = new JsonStore<TestRecord>({ filePath });

    await store.write([{ id: "item_1", value: 10 }]);

    const failingStore = new JsonStore<TestRecord>({
      filePath,
      fileSystem: {
        async rename() {
          throw Object.assign(new Error("rename failed"), { code: "EACCES" });
        }
      }
    });

    await assert.rejects(() => failingStore.write([{ id: "item_2", value: 20 }]));

    assert.deepEqual(await store.read(), [{ id: "item_1", value: 10 }]);
    assert.equal((await readdir(dir)).some((fileName) => fileName.endsWith(".tmp")), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("JsonStore serializes concurrent in-process updates per file", async () => {
  const dir = await createTempDir();

  try {
    const store = new JsonStore<TestRecord>({ filePath: join(dir, "items.json") });
    await store.write([{ id: "counter", value: 0 }]);

    await Promise.all(
      Array.from({ length: 25 }, async () => {
        await store.update((items) =>
          items.map((item) => (item.id === "counter" ? { ...item, value: (item.value ?? 0) + 1 } : item))
        );
      })
    );

    assert.deepEqual(await store.read(), [{ id: "counter", value: 25 }]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
