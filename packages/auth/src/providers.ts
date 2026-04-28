import { requireEnv } from "@repo/helpers";

export type SocialProvider = "apple" | "google";

type OAuthProfile = {
  email: string;
  firstName: string;
  lastName: string;
  subject: string;
  verified: boolean;
};

type ExchangeOptions = {
  code: string;
  verifier?: string;
  userForm?: string | null;
};

type GoogleIdToken = {
  email: string;
  email_verified?: boolean;
  family_name?: string;
  given_name?: string;
  sub: string;
};

type AppleIdToken = {
  email: string;
  email_verified?: boolean | "true" | "false";
  sub: string;
};

type AppleUserForm = {
  name?: {
    firstName?: string;
    lastName?: string;
  };
};

const AUTHORIZATION_ENDPOINT_BY_PROVIDER = {
  apple: "https://appleid.apple.com/auth/authorize",
  google: "https://accounts.google.com/o/oauth2/v2/auth",
} satisfies Record<SocialProvider, string>;

/**
 * Returns the provider authorization URL used to start an OAuth login flow.
 *
 * @param provider - OAuth provider selected by the user.
 * @returns Fully configured authorization URL for the provider.
 * @throws {Error} If required provider or site environment variables are missing.
 */
function getAuthorizationUrl(provider: SocialProvider): URL {
  const redirectUri = `${requireEnv("CONVEX_SITE_URL")}/auth/callback/${provider}`;
  const url = new URL(AUTHORIZATION_ENDPOINT_BY_PROVIDER[provider]);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);

  if (provider === "google") {
    url.searchParams.set("client_id", requireEnv("GOOGLE_CLIENT_ID"));
    url.searchParams.set("scope", "openid email profile");
  } else {
    url.searchParams.set("client_id", requireEnv("APPLE_CLIENT_ID"));
    url.searchParams.set("scope", "name email");
    url.searchParams.set("response_mode", "form_post");
  }

  return url;
}

/**
 * Decodes and parses the payload segment from a JWT id_token.
 *
 * This helper intentionally does not verify signatures. Tokens are fetched from
 * provider token endpoints, and this code only needs claim extraction.
 *
 * @typeParam T - Expected payload shape.
 * @param idToken - Raw JWT id_token value returned by the provider.
 * @returns Parsed payload claims.
 * @throws {Error} If the token format is invalid or payload JSON cannot be parsed.
 */
function decodeJwtPayload<T>(idToken: string): T {
  const [, payloadPart] = idToken.split(".");
  if (!payloadPart) throw new Error("Malformed ID token.");

  const padded =
    payloadPart.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (payloadPart.length % 4)) % 4);

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

/**
 * Exchanges an OAuth authorization code and normalizes identity claims into
 * the internal profile shape consumed by auth routes.
 *
 * Apple only includes the user name on the first consent via callback form
 * payload, so `userForm` is consumed opportunistically when present.
 *
 * @param provider - Provider that issued the authorization code.
 * @param options - Exchange payload and provider-specific fields.
 * @param options.code - OAuth authorization code returned to the callback.
 * @param options.verifier - PKCE verifier required for Google.
 * @param options.userForm - Optional raw Apple `user` form field JSON.
 * @returns Normalized OAuth profile.
 * @throws {Error} If required exchange inputs are missing or provider exchange fails.
 */
async function exchangeCode(
  provider: SocialProvider,
  options: ExchangeOptions,
): Promise<OAuthProfile> {
  const redirectUri = `${requireEnv("CONVEX_SITE_URL")}/auth/callback/${provider}`;

  if (provider === "google") {
    if (!options.verifier) {
      throw new Error("Missing PKCE verifier for Google.");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: requireEnv("GOOGLE_CLIENT_ID"),
        client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
        code: options.code,
        code_verifier: options.verifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed (${response.status}).`);
    }

    const tokens = (await response.json()) as { id_token?: string };
    if (!tokens.id_token) {
      throw new Error("Missing Google id_token.");
    }

    const payload = decodeJwtPayload<GoogleIdToken>(tokens.id_token);

    return {
      email: payload.email?.toLowerCase() ?? "",
      firstName: payload.given_name ?? "",
      lastName: payload.family_name ?? "",
      subject: payload.sub,
      verified: payload.email_verified ?? false,
    };
  }

  const response = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("APPLE_CLIENT_ID"),
      client_secret: requireEnv("APPLE_CLIENT_SECRET"),
      code: options.code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed (${response.status}).`);
  }

  const tokens = (await response.json()) as { id_token?: string };
  if (!tokens.id_token) {
    throw new Error("Missing Apple id_token.");
  }

  const payload = decodeJwtPayload<AppleIdToken>(tokens.id_token);

  let firstName = "";
  let lastName = "";

  if (options.userForm) {
    try {
      const parsed = JSON.parse(options.userForm) as AppleUserForm;
      firstName = parsed.name?.firstName ?? "";
      lastName = parsed.name?.lastName ?? "";
    } catch {
      // Ignore malformed user payload.
    }
  }

  return {
    email: payload.email?.toLowerCase() ?? "",
    firstName,
    lastName,
    subject: payload.sub,
    verified: payload.email_verified === true || payload.email_verified === "true",
  };
}

/**
 * Creates a PKCE verifier/challenge pair using the S256 transform.
 *
 * @returns PKCE values to attach to authorization and token requests.
 */
async function createPkce(): Promise<{
  challenge: string;
  method: "S256";
  verifier: string;
}> {
  const toBase64Url = (bytes: Uint8Array) => {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  };

  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  const verifier = toBase64Url(bytes);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = toBase64Url(new Uint8Array(digest));

  return { challenge, method: "S256", verifier };
}

export { createPkce, exchangeCode, getAuthorizationUrl };
