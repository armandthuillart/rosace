import { describe, expect, it, vi } from "vite-plus/test";

const { RateLimiterMock, throttlerInstance } = vi.hoisted(() => {
  const throttlerInstance = { __type: "throttler-instance" };
  return {
    RateLimiterMock: vi.fn().mockImplementation(() => throttlerInstance),
    throttlerInstance,
  };
});

vi.mock("@convex-dev/rate-limiter", () => ({
  RateLimiter: RateLimiterMock,
  MINUTE: 60,
  SECOND: 1,
}));

vi.mock("./_generated/api", () => ({
  components: {
    rateLimiter: "rate-limiter-component",
  },
}));

import { throttler } from "./throttler";

describe("throttler", () => {
  it("should construct the RateLimiter with all throttle rules", () => {
    expect(RateLimiterMock).toHaveBeenCalledTimes(1);
    expect(RateLimiterMock).toHaveBeenCalledWith("rate-limiter-component", {
      login: {
        kind: "fixed window",
        period: 10,
        rate: 3,
      },
      logout: {
        kind: "fixed window",
        period: 60,
        rate: 100,
      },
      oauth: {
        kind: "fixed window",
        period: 60,
        rate: 20,
      },
    });
  });

  it("should export the created rate limiter instance", () => {
    expect(throttler).toEqual(throttlerInstance);
  });
});
