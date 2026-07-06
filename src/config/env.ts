export type AppEnv = {
  host: string;
  port: number;
  nodeEnv: string;
  logLevel: string;
  authTokenSecret: string;
  authTokenTtlSeconds: number;
};

const DEFAULT_PORT = 3000;
const DEFAULT_AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 8;

function parsePort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return port;
}

function parsePositiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (!value) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`Invalid ${name} value: ${value}`);
  }

  return parsedValue;
}

export function loadEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  return {
    host: env.HOST ?? "0.0.0.0",
    port: parsePort(env.PORT),
    nodeEnv: env.NODE_ENV ?? "development",
    logLevel: env.LOG_LEVEL ?? "info",
    authTokenSecret: env.AUTH_TOKEN_SECRET ?? "dev-auth-token-secret-change-me",
    authTokenTtlSeconds: parsePositiveInteger(
      env.AUTH_TOKEN_TTL_SECONDS,
      DEFAULT_AUTH_TOKEN_TTL_SECONDS,
      "AUTH_TOKEN_TTL_SECONDS"
    )
  };
}
