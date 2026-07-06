import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { JsonStore } from "../../src/storage/jsonStore.js";
import { createRepository } from "../../src/storage/repositories/index.js";

type TestRecord = {
  id: string;
  name: string;
};

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "erp-symb-repository-"));
}

test("JsonRepository supports idempotent upsertMany by id", async () => {
  const dir = await createTempDir();

  try {
    const repository = createRepository(new JsonStore<TestRecord>({ filePath: join(dir, "items.json") }));

    await repository.upsertMany([
      { id: "one", name: "One" },
      { id: "two", name: "Two" }
    ]);
    await repository.upsertMany([
      { id: "one", name: "One updated" },
      { id: "two", name: "Two" }
    ]);

    assert.deepEqual(await repository.findAll(), [
      { id: "one", name: "One updated" },
      { id: "two", name: "Two" }
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});


test("JsonRepository rejects updates that try to change item id", async () => {
  const dir = await createTempDir();

  try {
    const repository = createRepository(new JsonStore<TestRecord>({ filePath: join(dir, "items.json") }));

    await repository.replaceAll([
      { id: "one", name: "One" },
      { id: "two", name: "Two" }
    ]);

    await assert.rejects(
      () => repository.update("one", (item) => ({ ...item, id: "two", name: "Changed" })),
      { name: "RepositoryError" }
    );

    await assert.rejects(
      () => repository.update("one", { id: "three", name: "Changed" }),
      { name: "RepositoryError" }
    );

    assert.deepEqual(await repository.findAll(), [
      { id: "one", name: "One" },
      { id: "two", name: "Two" }
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
