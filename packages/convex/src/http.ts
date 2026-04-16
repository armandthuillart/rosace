import { HttpRouter } from "@repo/better-auth/http";
import { Hono } from "hono";

import { httpMiddleware } from "./_crpc";

const app = new Hono();

app.use(httpMiddleware());

const router = new HttpRouter(app);

export default router;
