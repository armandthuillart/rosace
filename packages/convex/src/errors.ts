import { ConvexError as BaseConvexError } from "convex/values";

const ERROR_CODES = [
  "PARSE_ERROR",
  "BAD_REQUEST",
  "INTERNAL_SERVER_ERROR",
  "NOT_IMPLEMENTED",
  "BAD_GATEWAY",
  "SERVICE_UNAVAILABLE",
  "GATEWAY_TIMEOUT",
  "UNAUTHORIZED",
  "PAYMENT_REQUIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "METHOD_NOT_SUPPORTED",
  "TIMEOUT",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "UNPROCESSABLE_CONTENT",
  "PRECONDITION_REQUIRED",
  "TOO_MANY_REQUESTS",
  "CLIENT_CLOSED_REQUEST",
] as const;

type ErrorCode = (typeof ERROR_CODES)[number];

interface ErrorData {
  code: ErrorCode;
  message: string;
  [key: string]: string | undefined;
}

interface ErrorOptions {
  code: ErrorCode;
  message?: string;
}

class ConvexError extends BaseConvexError<ErrorData> {
  readonly code: ErrorCode;

  constructor(opts: ErrorOptions) {
    const { code, message = code } = opts;

    super({
      code,
      message,
    });

    this.name = "ConvexError";
    this.code = code;
    this.message = message;
  }
}

export { ConvexError };
