interface HandlerOptions {
	baseURL: string;
}

function handler(req: Request, opts: HandlerOptions) {
	const { baseURL } = opts;

	const request = new URL(req.url);
	const nextUrl = new URL(`${baseURL}${request.pathname}${request.search}`);

	const headers = new Headers(req.headers);
	headers.set("accept-encoding", "application/json");
	headers.set("host", new URL(baseURL).host);

	const response = fetch(nextUrl, {
		body: req.body,
		duplex: "half",
		headers,
		method: req.method,
		redirect: "manual",
	});

	return response;
}

export { handler };
