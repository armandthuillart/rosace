import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import resend from "@convex-dev/resend/convex.config";
import { defineApp } from "convex/server";
import posthog from "@posthog/convex/convex.config.js";

const app = defineApp();
app.use(rateLimiter);
app.use(posthog);
app.use(resend);

export default app;
