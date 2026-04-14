import { env } from "$env/dynamic/public";
import type { RequestHandler } from "@sveltejs/kit";

function proxy(req: Request, siteURL: string) {
  const requestURL = new URL(req.url);
  const nextURL = new URL(`${siteURL}${requestURL.pathname}${requestURL.search}`);

  const request = new Request(nextURL, req);
  request.headers.set("accept-encoding", "application/json");

  const response = fetch(request, {
    method: req.method,
    redirect: "manual",
  });

  return response;
}

function handler() {
  const requestHandler: RequestHandler = async ({ request }) => {
    return proxy(request, env.PUBLIC_CONVEX_SITE_URL);
  };

  return {
    GET: requestHandler,
    POST: requestHandler,
  };
}

export { handler };
