import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

async function collectTests(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectTests(path));
    } else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      files.push(path);
    }
  }

  return files.sort();
}

const files = await collectTests("tests");

if (files.length === 0) {
  console.error("No test files found");
  process.exit(1);
}

const child = spawn(process.execPath, ["--test", "--import", "tsx", ...files], {
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Test process terminated by ${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});
