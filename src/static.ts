import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

import type { FastifyInstance } from "fastify";

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

export function registerStaticFrontend(app: FastifyInstance, publicDir = resolve(process.cwd(), "public")): void {
  app.get("/", async (_request, reply) => {
    const html = await readFile(join(publicDir, "index.html"), "utf8");

    void reply.type("text/html; charset=utf-8");

    return html;
  });

  app.get<{ Params: { "*": string } }>("/assets/*", async (request, reply) => {
    const assetPath = normalize(request.params["*"] ?? "");
    const filePath = resolve(publicDir, "assets", assetPath);
    const assetsRoot = resolve(publicDir, "assets");

    if (filePath !== assetsRoot && !filePath.startsWith(assetsRoot + sep)) {
      void reply.code(404);
      return "Not found";
    }

    try {
      const content = await readFile(filePath);
      void reply.type(contentTypes[extname(filePath)] ?? "application/octet-stream");
      return content;
    } catch (error) {
      void reply.code(404);
      return "Not found";
    }
  });
}
