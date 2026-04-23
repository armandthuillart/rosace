import { HttpRouter } from "convex/server";

import { registerRoutes } from "./auth";

const http = new HttpRouter();

registerRoutes(http);

export default http;
