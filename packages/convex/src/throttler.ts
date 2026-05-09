import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";

import { components } from "./_generated/api";

export const throttler = new RateLimiter(components.rateLimiter, {
  logout: {
    kind: "fixed window",
    rate: 100,
    period: MINUTE,
  },
  oauth: {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
});
