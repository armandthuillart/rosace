type ClientErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "TOO_MANY_REQUESTS";

class ClientError extends Error {
  readonly name = "ClientError";
  readonly code: ClientErrorCode;
  readonly functionName: string;

  constructor(opts: { code: ClientErrorCode; functionName: string; message?: string }) {
    const { code, functionName, message } = opts;

    super(message ?? `${code}: ${functionName}`);
    this.code = code;
    this.functionName = functionName;
  }
}

export { ClientError };
