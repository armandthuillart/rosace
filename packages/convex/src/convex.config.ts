import rateLimiter from '@convex-dev/rate-limiter/convex.config';
import posthog from '@posthog/convex/convex.config.js';
import { defineApp } from 'convex/server';

const app = defineApp();
app.use(posthog);
app.use(rateLimiter);

export default app;
