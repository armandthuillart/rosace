import { defineApp } from "convex/server";
import posthog from "@posthog/convex/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

const app = defineApp();
app.use(posthog);
app.use(rateLimiter);

export default app;
