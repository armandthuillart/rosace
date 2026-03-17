import { ConvexError } from "convex/values";

const CRPC_ERROR_CODES = [
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

/**
 * Standard CRPC error codes. We extend the ConvexError class to add a code and message, for simpler error handling on the client.
 */
export type CRPCErrorCode = (typeof CRPC_ERROR_CODES)[number];

interface CRPCErrorData {
	code: CRPCErrorCode;
	message: string;
	[key: string]: string | undefined;
}

interface CRPCErrorOptions {
	code: CRPCErrorCode;
	message?: string;
}

/**
 * Convex-compatible error with a code and message.
 *
 * @example
 * ```typescript
 * throw new CRPCError({ code: "UNAUTHORIZED" });
 * ```
 *
 * @see {@link CRPCErrorCode}
 */
export class CRPCError extends ConvexError<CRPCErrorData> {
	readonly code: CRPCErrorCode;

	constructor(opts: CRPCErrorOptions) {
		const { code, message = code } = opts;

		super({
			code,
			message,
		});

		this.name = "CRPCError";
		this.code = code;
	}
}
