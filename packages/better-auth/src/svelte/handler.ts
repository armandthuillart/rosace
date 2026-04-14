import type { RequestHandler } from "@sveltejs/kit";

declare global {
  interface ImportMetaEnv {
    readonly PUBLIC_CONVEX_SITE_URL: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

function proxy(req: Request) {
  const siteURL = import.meta.env.PUBLIC_CONVEX_SITE_URL;
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
    return proxy(request);
  };

  return {
    GET: requestHandler,
    POST: requestHandler,
  };
}

export { handler };
