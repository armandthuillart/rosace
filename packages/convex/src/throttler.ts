import { RateLimiter, MINUTE, SECOND } from "@convex-dev/rate-limiter";

import { components } from "./_generated/api";

export const throttler = new RateLimiter(components.rateLimiter, {
  login: { kind: "fixed window", rate: 3, period: 10 * SECOND },
  oauth: { kind: "fixed window", rate: 20, period: MINUTE },
  logout: { kind: "fixed window", rate: 100, period: MINUTE },
});
