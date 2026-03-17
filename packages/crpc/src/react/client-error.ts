type ClientErrorCode =
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "BAD_REQUEST"
	| "TOO_MANY_REQUESTS";

class CRPCError extends Error {
	readonly name = "CRPCError";
	readonly code: ClientErrorCode;
	readonly functionName: string;

	constructor(opts: {
		code: ClientErrorCode;
		functionName: string;
		message?: string;
	}) {
		const { code, functionName, message } = opts;

		super(message ?? `${code}: ${functionName}`);
		this.code = code;
		this.functionName = functionName;
	}
}

export { CRPCError };
