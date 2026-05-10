import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createPKCE, getAuthorizationURL } from "./oauth";

beforeEach(() => {
  vi.stubEnv("DASHBOARD_URL", "https://app.example");
  vi.stubEnv("GOOGLE_CLIENT_ID", "google-client-id");
  vi.stubEnv("APPLE_CLIENT_ID", "apple-client-id");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAuthorizationURL", () => {
  it("should build Google OAuth URL with correct endpoint and params", () => {
    const url = getAuthorizationURL("google");

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.pathname).toBe("/o/oauth2/v2/auth");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("google-client-id");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example/auth/callback/google");
    expect(url.searchParams.has("response_mode")).toBe(false);
  });

  it("should build Apple OAuth URL with correct endpoint and params", () => {
    const url = getAuthorizationURL("apple");

    expect(url.origin).toBe("https://appleid.apple.com");
    expect(url.pathname).toBe("/auth/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("apple-client-id");
    expect(url.searchParams.get("scope")).toBe("name email");
    expect(url.searchParams.get("response_mode")).toBe("form_post");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example/auth/callback/apple");
  });

  it("should throw when DASHBOARD_URL is missing", () => {
    vi.stubEnv("DASHBOARD_URL", "");

    const act = () => getAuthorizationURL("google");

    expect(act).toThrow("DASHBOARD_URL is missing and must be set");
  });
});

describe("createPKCE", () => {
  it("should return S256 method with verifier and challenge", async () => {
    const result = await createPKCE();

    expect(result).toEqual({
      method: "S256",
      verifier: expect.any(String),
      challenge: expect.any(String),
    });
  });

  it("should produce a base64url-encoded verifier without padding", async () => {
    const { verifier } = await createPKCE();

    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifier).not.toContain("=");
  });

  it("should produce a challenge that matches SHA-256 hash of the verifier", async () => {
    const { verifier, challenge } = await createPKCE();

    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const bytes = new Uint8Array(digest);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const expected = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    expect(challenge).toBe(expected);
  });
});
