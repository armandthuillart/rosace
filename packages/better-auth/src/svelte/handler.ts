import { RequestHandler } from "@sveltejs/kit";

async function forwardRequest(request: Request, address: string) {
  const source = new URL(request.url);
  const target = new URL(source.pathname + source.search, address);

  const headers = new Headers(request.headers);
  headers.set("accept-encoding", "application/json");
  headers.set("host", new URL(address).host);
  headers.set("x-forwarded-host", source.host);
  headers.set("x-forwarded-proto", source.protocol.replace(/:$/, ""));
  headers.set("x-better-auth-forwarded-host", source.host);
  headers.set("x-better-auth-forwarded-proto", source.protocol.replace(/:$/, ""));

  return fetch(target, {
    method: request.method,
    headers,
    redirect: "manual",
    body: request.body,
    // @ts-expect-error - duplex is required for streaming request bodies in modern fetch
    duplex: "half",
  });
}

function requestHandler(address: string) {
  const handler: RequestHandler = async ({ request }) => {
    return forwardRequest(request, address);
  };
  return { GET: handler, POST: handler };
}

export { requestHandler };
