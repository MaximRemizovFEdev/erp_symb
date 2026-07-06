import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();
const app = buildApp();

async function start(): Promise<void> {
  try {
    await app.listen({
      host: env.host,
      port: env.port
    });
  } catch (error) {
    app.log.fatal({ err: error }, "Failed to start HTTP server");
    process.exit(1);
  }
}

const shutdownSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

for (const signal of shutdownSignals) {
  process.on(signal, () => {
    app.log.info({ signal }, "Shutting down HTTP server");
    app.close()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        app.log.error({ err: error }, "Failed to shut down HTTP server");
        process.exit(1);
      });
  });
}

void start();
