import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { AppError } from "../../shared/errors.js";

const pbkdf2Async = promisify(pbkdf2);
const PASSWORD_HASH_ALGORITHM = "sha256";
const PASSWORD_HASH_ITERATIONS = 120000;
const PASSWORD_HASH_KEY_LENGTH = 32;

export async function hashPassword(password: string): Promise<string> {
  if (!password) {
    throw new AppError("Password is required", {
      code: "PASSWORD_REQUIRED",
      statusCode: 400
    });
  }

  const salt = randomBytes(16).toString("base64url");
  const hash = await pbkdf2Async(
    password,
    salt,
    PASSWORD_HASH_ITERATIONS,
    PASSWORD_HASH_KEY_LENGTH,
    PASSWORD_HASH_ALGORITHM
  );

  return ["pbkdf2", PASSWORD_HASH_ALGORITHM, String(PASSWORD_HASH_ITERATIONS), salt, hash.toString("base64url")].join(
    "$"
  );
}

export async function verifyPassword(password: string, passwordHash: string | undefined): Promise<boolean> {
  if (!passwordHash) {
    return false;
  }

  const parts = passwordHash.split("$");

  if (parts.length !== 5 || parts[0] !== "pbkdf2") {
    return false;
  }

  const [, algorithm, iterationsRaw, salt, expectedHashRaw] = parts;
  const iterations = Number(iterationsRaw);

  if (algorithm !== PASSWORD_HASH_ALGORITHM || !Number.isInteger(iterations) || iterations <= 0 || !salt) {
    return false;
  }

  const expectedHash = Buffer.from(expectedHashRaw ?? "", "base64url");
  const actualHash = await pbkdf2Async(password, salt, iterations, expectedHash.length, algorithm);

  return expectedHash.length === actualHash.length && timingSafeEqual(expectedHash, actualHash);
}
