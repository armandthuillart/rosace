import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import posthog from "@posthog/convex/convex.config.js";

const app = defineApp();
app.use(rateLimiter);
app.use(posthog);

export default app;
