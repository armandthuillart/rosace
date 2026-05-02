import { describe, expect, it } from "vite-plus/test";

import { ConvexError } from "./errors";

describe("ConvexError", () => {
  it("should set code and default message to code when not provided", () => {
    const error = new ConvexError({ code: "NOT_FOUND" });

    expect(error.name).toBe("ConvexError");
    expect(error.code).toBe("NOT_FOUND");
    expect(error.data.code).toBe("NOT_FOUND");
  });

  it("should use provided message when given", () => {
    const error = new ConvexError({ code: "UNAUTHORIZED", message: "Invalid token" });

    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.data.message).toBe("Invalid token");
  });

  it("should work with UNAUTHORIZED code", () => {
    const error = new ConvexError({ code: "UNAUTHORIZED" });

    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("should work with TOO_MANY_REQUESTS code", () => {
    const error = new ConvexError({ code: "TOO_MANY_REQUESTS" });

    expect(error.code).toBe("TOO_MANY_REQUESTS");
  });

  it("should be instanceof ConvexError", () => {
    const error = new ConvexError({ code: "INTERNAL_SERVER_ERROR" });

    expect(error).toBeInstanceOf(ConvexError);
  });

  it("should have data with code and message properties", () => {
    const error = new ConvexError({ code: "BAD_REQUEST", message: "Bad input" });

    expect(error.data).toBeDefined();
    expect(error.data.code).toBe("BAD_REQUEST");
    expect(error.data.message).toBe("Bad input");
  });
});
