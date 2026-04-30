import { describe, expect, it, vi } from "vite-plus/test";

import { ConvexError } from "./errors";
import { authMiddleware, authQuery, authMutation, authAction } from "./middleware";

describe("authMiddleware", () => {
  it("throws UNAUTHORIZED when user is not authenticated", async () => {
    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue(null),
      },
    } as any;

    const next = vi.fn();

    await expect(authMiddleware(ctx, next)).rejects.toThrow(ConvexError);

    try {
      await authMiddleware(ctx, next);
    } catch (e: any) {
      expect(e.code).toBe("UNAUTHORIZED");
    }

    expect(next).not.toHaveBeenCalled();
  });

  it("adds userId to context when user is authenticated", async () => {
    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({
          subject: "user_123",
        }),
      },
    } as any;

    const next = vi.fn().mockResolvedValue({ context: { ...ctx, userId: "user_123" as any } });

    const result = await authMiddleware(ctx, next);

    expect(ctx.auth.getUserIdentity).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("passes userId as Id<'users'> type", async () => {
    const userId = "user_abc123" as any;
    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({
          subject: userId,
        }),
      },
    } as any;

    let capturedContext: any;
    const next = vi.fn().mockImplementation((ctx) => {
      capturedContext = ctx;
      return { context: ctx };
    });

    await authMiddleware(ctx, next);

    expect(capturedContext.userId).toBe(userId);
  });
});

describe("pre-configured auth builders", () => {
  it("authQuery has query function type", () => {
    expect(authQuery).toBeDefined();
  });

  it("authMutation has mutation function type", () => {
    expect(authMutation).toBeDefined();
  });

  it("authAction has action function type", () => {
    expect(authAction).toBeDefined();
  });

  it("authQuery can have a handler attached", () => {
    const withHandler = authQuery.handler(async (ctx) => {
      void ctx.userId;
      return "test";
    });

    expect(typeof withHandler).toBe("function");
  });

  it("authQuery handler rejects without auth context", async () => {
    const query = authQuery.handler(async (ctx) => {
      void ctx.userId;
      return "should not reach";
    });

    const unauthedCtx = {} as any;

    await expect(query(unauthedCtx, {})).rejects.toThrow();
  });
});
