import { describe, expect, it } from "vite-plus/test";

import { throttler } from "./throttler";

describe("throttler", () => {
  it("exports a RateLimiter instance", () => {
    expect(throttler).toBeDefined();
  });
});
