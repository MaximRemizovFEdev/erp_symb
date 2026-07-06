export type ErrorResponse = {
  error: {
    code: string;
    message: string;
    statusCode: number;
  };
};

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, options: { statusCode?: number; code?: string } = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? "INTERNAL_ERROR";
  }
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message);
  }

  return new AppError("Unexpected error");
}
