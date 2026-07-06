import { createHmac, timingSafeEqual } from "node:crypto";

import { AppError } from "../../shared/errors.js";
import { isRole, type AuthUser, type Role } from "./types.js";

type TokenPayload = {
  sub: string;
  username: string;
  role: Role;
  employeeId?: string;
  exp: number;
};

export type TokenServiceOptions = {
  secret: string;
  ttlSeconds: number;
};

export class TokenService {
  constructor(private readonly options: TokenServiceOptions) {}

  sign(user: AuthUser): string {
    const payload: TokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + this.options.ttlSeconds
    };

    if (user.employeeId !== undefined) {
      payload.employeeId = user.employeeId;
    }

    const header = encodeJson({ alg: "HS256", typ: "ERP_TOKEN" });
    const body = encodeJson(payload);
    const signature = this.signValue(header + "." + body);

    return header + "." + body + "." + signature;
  }

  verify(token: string): AuthUser {
    const parts = token.split(".");

    if (parts.length !== 3) {
      throw unauthorized("Invalid token");
    }

    const [header, body, signature] = parts;

    if (!header || !body || !signature || !this.verifySignature(header + "." + body, signature)) {
      throw unauthorized("Invalid token");
    }

    const payload = decodeJson(body) as Partial<TokenPayload>;

    if (
      typeof payload.sub !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.role !== "string" ||
      !isRole(payload.role) ||
      typeof payload.exp !== "number"
    ) {
      throw unauthorized("Invalid token payload");
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw unauthorized("Token expired");
    }

    const authUser: AuthUser = {
      id: payload.sub,
      username: payload.username,
      role: payload.role
    };

    if (typeof payload.employeeId === "string") {
      authUser.employeeId = payload.employeeId;
    }

    return authUser;
  }

  private signValue(value: string): string {
    return createHmac("sha256", this.options.secret).update(value).digest("base64url");
  }

  private verifySignature(value: string, signature: string): boolean {
    const expectedSignature = Buffer.from(this.signValue(value));
    const actualSignature = Buffer.from(signature);

    return expectedSignature.length === actualSignature.length && timingSafeEqual(expectedSignature, actualSignature);
  }
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeJson(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch (error) {
    throw unauthorized("Invalid token payload");
  }
}

function unauthorized(message: string): AppError {
  return new AppError(message, {
    code: "UNAUTHORIZED",
    statusCode: 401
  });
}
