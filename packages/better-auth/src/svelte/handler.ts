import type { RequestHandler } from "@sveltejs/kit";

function handler(req: Request, opts: { siteURL: string }) {
  const { siteURL } = opts;

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

function betterAuth(opts: { siteURL: string }) {
  const requestHandler: RequestHandler = async ({ request }) => {
    return handler(request, opts);
  };

  return {
    GET: requestHandler,
    POST: requestHandler,
  };
}

export { betterAuth };
