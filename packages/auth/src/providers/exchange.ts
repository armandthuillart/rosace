import type { SocialProvider } from "../types";
import { fromBase64Url, requireEnv } from "../utils";
import { callbackUrl } from "./authorization-url";

type OAuthProfile = {
  email: string;
  firstName: string;
  lastName: string;
  subject: string;
  verified: boolean;
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

function decodeJwtPayload<T>(token: string): T {
  const [, payload] = token.split(".");
  if (!payload) throw new Error("Malformed ID token.");
  return JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as T;
}

async function postForm(url: string, body: URLSearchParams) {
  const response = await fetch(url, {
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed (${response.status}).`);
  }

  return (await response.json()) as { id_token?: string };
}

async function exchangeGoogle(code: string, verifier: string): Promise<OAuthProfile> {
  const body = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: callbackUrl("google"),
  });

  const tokens = await postForm("https://oauth2.googleapis.com/token", body);
  if (!tokens.id_token) throw new Error("Missing Google id_token.");

  const payload = decodeJwtPayload<GoogleIdToken>(tokens.id_token);

  return {
    email: payload.email?.toLowerCase() ?? "",
    firstName: payload.given_name ?? "",
    lastName: payload.family_name ?? "",
    subject: payload.sub,
    verified: payload.email_verified ?? false,
  };
}

async function exchangeApple(code: string, userForm?: string | null): Promise<OAuthProfile> {
  const body = new URLSearchParams({
    client_id: requireEnv("APPLE_CLIENT_ID"),
    client_secret: requireEnv("APPLE_CLIENT_SECRET"),
    code,
    grant_type: "authorization_code",
    redirect_uri: callbackUrl("apple"),
  });

  const tokens = await postForm("https://appleid.apple.com/auth/token", body);
  if (!tokens.id_token) throw new Error("Missing Apple id_token.");

  const payload = decodeJwtPayload<AppleIdToken>(tokens.id_token);

  // Apple only surfaces the user's name on the very first authentication, via
  // the `user` form field on the callback. Subsequent logins rely on our DB.
  let firstName = "";
  let lastName = "";
  if (userForm) {
    try {
      const parsed = JSON.parse(userForm) as AppleUserForm;
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

async function exchangeProviderCode(
  provider: SocialProvider,
  code: string,
  { userForm, verifier }: { userForm?: string | null; verifier?: string },
) {
  if (provider === "google") {
    if (!verifier) throw new Error("Missing PKCE verifier for Google.");
    return exchangeGoogle(code, verifier);
  }

  return exchangeApple(code, userForm);
}

export { exchangeApple, exchangeGoogle, exchangeProviderCode };
export type { OAuthProfile };
