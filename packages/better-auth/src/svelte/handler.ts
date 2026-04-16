import { env } from "$env/dynamic/public";
import { RequestHandler } from "@sveltejs/kit";

const CONVEX_SITE_URL = env.PUBLIC_CONVEX_SITE_URL;

async function forward(request: Request) {
  const source = new URL(request.url);
  const target = new URL(source.pathname + source.search, CONVEX_SITE_URL);

  return fetch(target, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: "manual",
  });
}

function handler() {
  const requestHandler: RequestHandler = async ({ request }) => forward(request);
  return { GET: requestHandler, POST: requestHandler };
}

export { handler };
