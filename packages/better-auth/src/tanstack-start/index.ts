import { getRequestHeaders } from "@tanstack/react-start/server";
import { getSessionCookie as getCookie } from "better-auth/cookies";
import { decodeJwt } from "jose";
import { cache } from "react";

interface ProxyOptions {
	baseURL: string | undefined;
}

function betterAuth({ baseURL }: ProxyOptions) {
	if (!baseURL) {
		throw new Error("betterAuth requires a baseURL.");
	}

	const getCachedJwt = cache(
		async ({ forceRefresh }: { forceRefresh: boolean }) => {
			const requestHeaders = getRequestHeaders();
			const mutableHeaders = new Headers(requestHeaders);
			mutableHeaders.delete("content-length");
			mutableHeaders.delete("transfer-encoding");
			mutableHeaders.set("accept-encoding", "identity");

			const { jwt, isFresh } = await getJwt({
				baseURL,
				forceRefresh,
				mutableHeaders,
			});

			return {
				isFresh,
				jwt,
			};
		},
	);

	return {
		getJwt: async () => {
			const { jwt } = await getCachedJwt({
				forceRefresh: false,
			});
			return jwt;
		},
	};
}

interface GetJwtOptions extends ProxyOptions {
	forceRefresh: boolean;
	mutableHeaders: Headers;
}

async function getJwt({
	baseURL,
	forceRefresh,
	mutableHeaders,
}: GetJwtOptions) {
	async function fetchToken() {
		const response = await fetch(new URL("/api/auth/convex/jwt", baseURL), {
			headers: mutableHeaders,
		});

		if (response.status === 401) {
			return {
				isFresh: false,
				jwt: undefined,
			};
		}

		if (!response.ok) {
			throw new Error(
				`Failed to fetch Convex JWT: ${response.status} ${response.statusText}`,
			);
		}

		const data = (await response.json()) as { jwt?: string; token?: string };
		const jwt = data.jwt ?? data.token;

		if (!jwt) {
			throw new Error("Convex JWT endpoint returned no jwt.");
		}

		return {
			isFresh: true,
			jwt,
		};
	}

	async function fetchTokenSafely() {
		try {
			return await fetchToken();
		} catch (error) {
			console.error("Failed to fetch Convex JWT", error);
			return {
				isFresh: false,
				jwt: undefined,
			};
		}
	}

	if (forceRefresh) {
		return await fetchTokenSafely();
	}

	const jwt = getCookie(mutableHeaders, {
		cookieName: "auth:jwt",
	});

	if (!jwt) {
		return await fetchTokenSafely();
	}

	try {
		const now = Math.floor(Date.now() / 1000);
		const claims = decodeJwt(jwt);
		const isExpired = claims.exp ? now > claims.exp + 60 : true;

		if (!isExpired) {
			return {
				isFresh: false,
				jwt,
			};
		}
	} catch (error) {
		console.error("Failed to decode JWT", error);
	}

	return await fetchTokenSafely();
}

export { betterAuth };

