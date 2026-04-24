import { SocialProvider } from "../types";
import { requireEnv } from "../utils";

const ENDPOINTS: Record<SocialProvider, string> = {
  google: "https://accounts.google.com/o/oauth2/v2/auth",
  apple: "https://appleid.apple.com/auth/authorize",
};

function callbackUrl(provider: SocialProvider) {
  return `${requireEnv("CONVEX_SITE_URL")}/auth/callback/${provider}`;
}

function authorize({ provider }: { provider: SocialProvider }) {
  const url = new URL(ENDPOINTS[provider]);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", callbackUrl(provider));

  if (provider === "google") {
    url.searchParams.set("client_id", requireEnv("GOOGLE_CLIENT_ID"));
    url.searchParams.set("scope", "openid email profile");
  } else if (provider === "apple") {
    url.searchParams.set("client_id", requireEnv("APPLE_CLIENT_ID"));
    url.searchParams.set("scope", "name email");
    url.searchParams.set("response_mode", "form_post");
  }

  return { url };
}

export { authorize, callbackUrl };
