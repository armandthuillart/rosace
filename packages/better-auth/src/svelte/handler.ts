import type { RequestHandler } from "@sveltejs/kit";

interface HandlerOptions {
  baseURL: string;
}

function handler(req: Request, opts: HandlerOptions) {
  const { baseURL } = opts;

  const requestURL = new URL(req.url);
  const nextURL = new URL(`${baseURL}${requestURL.pathname}${requestURL.search}`);

  const request = new Request(nextURL, req);
  request.headers.set("accept-encoding", "application/json");
  request.headers.set("host", new URL(nextURL).host);

  const response = fetch(request, {
    method: req.method,
    redirect: "manual",
  });

  return response;
}

function betterAuth(opts: HandlerOptions) {
  const requestHandler: RequestHandler = async ({ request }) => {
    return handler(request, opts);
  };

  return {
    GET: requestHandler,
    POST: requestHandler,
  };
}

export { betterAuth };
