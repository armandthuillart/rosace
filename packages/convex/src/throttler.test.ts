import { describe, expect, it } from "vite-plus/test";

import { throttler } from "./throttler";

describe("throttler", () => {
  it("should export a RateLimiter instance", () => {
    expect(throttler).toBeDefined();
  });
});
