import { HttpRouter } from "@repo/crpc/auth/http";
import { Hono } from "hono";
import { betterAuth } from "./crpc/http";
import { getEnv } from "./env";

const app = new Hono();

app.use(betterAuth({ baseURL: getEnv().DASHBOARD_URL }));

const router = new HttpRouter(app);

export default router;
