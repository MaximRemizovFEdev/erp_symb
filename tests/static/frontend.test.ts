import assert from "node:assert/strict";
import { test } from "node:test";

import { buildApp } from "../../src/app.js";

test("serves frontend shell and assets", async () => {
  const app = buildApp();

  try {
    const html = await app.inject({ method: "GET", url: "/" });
    assert.equal(html.statusCode, 200);
    assert.match(html.headers["content-type"]?.toString() ?? "", /text\/html/);
    assert.match(html.body, /id="app"/);

    const js = await app.inject({ method: "GET", url: "/assets/app.js" });
    assert.equal(js.statusCode, 200);
    assert.match(js.headers["content-type"]?.toString() ?? "", /javascript/);
    assert.match(js.body, /bootstrap\(\)/);
  } finally {
    await app.close();
  }
});

test("does not serve assets outside public assets directory", async () => {
  const app = buildApp();

  try {
    const response = await app.inject({ method: "GET", url: "/assets/../index.html" });
    assert.equal(response.statusCode, 404);
  } finally {
    await app.close();
  }
});
