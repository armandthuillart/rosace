import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { createRemoteJWKSetMock, jwtVerifyMock, requireEnvMock, env, googlePayload, applePayload } =
  vi.hoisted(() => ({
    createRemoteJWKSetMock: vi.fn((url: URL) => ({ url: url.toString() })),
    jwtVerifyMock: vi.fn(),
    env: {
      APPLE_CLIENT_ID: "apple-client-id",
      APPLE_CLIENT_SECRET: "apple-client-secret",
      DASHBOARD_URL: "https://app.example",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
    } as Record<string, string>,
    requireEnvMock: vi.fn((key: string) => {
      const value = env[key];
      if (!value) {
        throw new Error(`Missing env: ${key}`);
      }
      return value;
    }),
    googlePayload: {
      email: "USER@EXAMPLE.COM",
      email_verified: true,
      family_name: "Doe",
      given_name: "Jane",
      nonce: "nonce-123",
      sub: "google-subject",
    },
    applePayload: {
      email: "APPLE@EXAMPLE.COM",
      email_verified: "true",
      nonce: "nonce-apple",
      sub: "apple-subject",
    },
  }));

vi.mock("@repo/helpers", () => ({
  requireEnv: requireEnvMock,
}));

vi.mock("jose", () => ({
  createRemoteJWKSet: createRemoteJWKSetMock,
  jwtVerify: jwtVerifyMock,
}));

import { createPKCE, exchangeCodeForProfile, getAuthorizationUrl } from "./providers";

describe("oauth providers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe("getAuthorizationUrl", () => {
    it("should build Google authorization URL with required params", () => {
      const url = getAuthorizationUrl("google");

      expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("client_id")).toBe(env.GOOGLE_CLIENT_ID);
      expect(url.searchParams.get("scope")).toBe("openid email profile");
      expect(url.searchParams.get("redirect_uri")).toBe("https://app.example/auth/callback/google");
    });

    it("should build Apple authorization URL with form_post mode", () => {
      const url = getAuthorizationUrl("apple");

      expect(url.origin + url.pathname).toBe("https://appleid.apple.com/auth/authorize");
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("client_id")).toBe(env.APPLE_CLIENT_ID);
      expect(url.searchParams.get("scope")).toBe("name email");
      expect(url.searchParams.get("response_mode")).toBe("form_post");
      expect(url.searchParams.get("redirect_uri")).toBe("https://app.example/auth/callback/apple");
    });
  });

  describe("exchangeCodeForProfile", () => {
    it("should exchange and normalize Google identity payload", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ id_token: "google-token" }), {
          status: 200,
        }),
      );
      jwtVerifyMock.mockResolvedValue({ payload: googlePayload });

      const profile = await exchangeCodeForProfile("google", {
        code: "auth-code",
        nonce: "nonce-123",
        verifier: "pkce-verifier",
      });

      expect(profile).toEqual({
        accountId: "google-subject",
        email: "user@example.com",
        emailVerified: true,
        firstName: "Jane",
        lastName: "Doe",
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://oauth2.googleapis.com/token",
        expect.objectContaining({
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: expect.any(URLSearchParams),
        }),
      );

      const [, request] = fetchMock.mock.calls[0] ?? [];
      expect(request?.body).toBeInstanceOf(URLSearchParams);
      expect((request?.body as URLSearchParams)?.get("client_id")).toBe(env.GOOGLE_CLIENT_ID);
      expect((request?.body as URLSearchParams)?.get("client_secret")).toBe(
        env.GOOGLE_CLIENT_SECRET,
      );
      expect((request?.body as URLSearchParams)?.get("code")).toBe("auth-code");
      expect((request?.body as URLSearchParams)?.get("code_verifier")).toBe("pkce-verifier");
      expect((request?.body as URLSearchParams)?.get("grant_type")).toBe("authorization_code");
      expect((request?.body as URLSearchParams)?.get("redirect_uri")).toBe(
        "https://app.example/auth/callback/google",
      );

      expect(jwtVerifyMock).toHaveBeenCalledWith("google-token", expect.anything(), {
        audience: env.GOOGLE_CLIENT_ID,
        issuer: ["https://accounts.google.com", "accounts.google.com"],
      });
    });

    it("should throw when Google token exchange fails", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({}), { status: 401 }),
      );

      await expect(
        exchangeCodeForProfile("google", {
          code: "auth-code",
          nonce: "nonce-123",
          verifier: "pkce-verifier",
        }),
      ).rejects.toThrow("Token exchange failed (401).");
    });

    it("should throw when Google id_token is missing", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ access_token: "x" }), { status: 200 }),
      );

      await expect(
        exchangeCodeForProfile("google", {
          code: "auth-code",
          nonce: "nonce-123",
          verifier: "pkce-verifier",
        }),
      ).rejects.toThrow("Missing Google id_token.");
    });

    it("should throw when Google nonce does not match", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ id_token: "google-token" }), {
          status: 200,
        }),
      );
      jwtVerifyMock.mockResolvedValue({
        payload: {
          ...googlePayload,
          nonce: "different-nonce",
        },
      });

      await expect(
        exchangeCodeForProfile("google", {
          code: "auth-code",
          nonce: "nonce-123",
          verifier: "pkce-verifier",
        }),
      ).rejects.toThrow("Invalid Google nonce.");
    });

    it("should throw when Google JWT verification fails", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ id_token: "google-token" }), {
          status: 200,
        }),
      );
      jwtVerifyMock.mockRejectedValue(new Error("invalid signature"));

      await expect(
        exchangeCodeForProfile("google", {
          code: "auth-code",
          nonce: "nonce-123",
          verifier: "pkce-verifier",
        }),
      ).rejects.toThrow("invalid signature");
    });

    it("should throw when Google nonce is missing from token payload", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ id_token: "google-token" }), {
          status: 200,
        }),
      );
      jwtVerifyMock.mockResolvedValue({
        payload: {
          ...googlePayload,
          nonce: undefined,
        },
      });

      await expect(
        exchangeCodeForProfile("google", {
          code: "auth-code",
          nonce: "nonce-123",
          verifier: "pkce-verifier",
        }),
      ).rejects.toThrow("Invalid Google nonce.");
    });

    it("should throw when Google verifier is missing", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch");

      await expect(
        exchangeCodeForProfile("google", {
          code: "auth-code",
          nonce: "nonce-123",
        }),
      ).rejects.toThrow("Missing PKCE verifier for Google.");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should throw when Google subject claim is missing", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ id_token: "google-token" }), {
          status: 200,
        }),
      );
      jwtVerifyMock.mockResolvedValue({
        payload: {
          ...googlePayload,
          sub: undefined,
        },
      });

      await expect(
        exchangeCodeForProfile("google", {
          code: "auth-code",
          nonce: "nonce-123",
          verifier: "pkce-verifier",
        }),
      ).rejects.toThrow("Missing Google subject claim.");
    });

    it("should throw when Google email claim is missing", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ id_token: "google-token" }), {
          status: 200,
        }),
      );
      jwtVerifyMock.mockResolvedValue({
        payload: {
          ...googlePayload,
          email: undefined,
        },
      });

      await expect(
        exchangeCodeForProfile("google", {
          code: "auth-code",
          nonce: "nonce-123",
          verifier: "pkce-verifier",
        }),
      ).rejects.toThrow("Missing Google email claim.");
    });

    it("should exchange and normalize Apple identity payload with user form", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ id_token: "apple-token" }), {
          status: 200,
        }),
      );
      jwtVerifyMock.mockResolvedValue({ payload: applePayload });

      const profile = await exchangeCodeForProfile("apple", {
        code: "auth-code",
        nonce: "nonce-apple",
        userForm: JSON.stringify({
          name: {
            firstName: "Ada",
            lastName: "Lovelace",
          },
        }),
      });

      expect(profile).toEqual({
        accountId: "apple-subject",
        email: "apple@example.com",
        emailVerified: true,
        firstName: "Ada",
        lastName: "Lovelace",
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://appleid.apple.com/auth/token",
        expect.objectContaining({
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: expect.any(URLSearchParams),
        }),
      );

      const [, request] = fetchMock.mock.calls[0] ?? [];
      expect(request?.body).toBeInstanceOf(URLSearchParams);
      expect((request?.body as URLSearchParams)?.get("client_id")).toBe(env.APPLE_CLIENT_ID);
      expect((request?.body as URLSearchParams)?.get("client_secret")).toBe(
        env.APPLE_CLIENT_SECRET,
      );
      expect((request?.body as URLSearchParams)?.get("code")).toBe("auth-code");
      expect((request?.body as URLSearchParams)?.get("grant_type")).toBe("authorization_code");
      expect((request?.body as URLSearchParams)?.get("redirect_uri")).toBe(
        "https://app.example/auth/callback/apple",
      );

      expect(jwtVerifyMock).toHaveBeenCalledWith("apple-token", expect.anything(), {
        audience: env.APPLE_CLIENT_ID,
        issuer: "https://appleid.apple.com",
      });
    });

    it("should throw when Apple token exchange fails", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({}), { status: 400 }),
      );

      await expect(
        exchangeCodeForProfile("apple", {
          code: "auth-code",
          nonce: "nonce-apple",
        }),
      ).rejects.toThrow("Token exchange failed (400).");
    });

    it("should throw when Apple id_token is missing", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ access_token: "x" }), { status: 200 }),
      );

      await expect(
        exchangeCodeForProfile("apple", {
          code: "auth-code",
          nonce: "nonce-apple",
        }),
      ).rejects.toThrow("Missing Apple id_token.");
    });

    it("should throw when Apple nonce does not match", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ id_token: "apple-token" }), {
          status: 200,
        }),
      );
      jwtVerifyMock.mockResolvedValue({
        payload: {
          ...applePayload,
          nonce: "different-nonce",
        },
      });

      await expect(
        exchangeCodeForProfile("apple", {
          code: "auth-code",
          nonce: "nonce-apple",
        }),
      ).rejects.toThrow("Invalid Apple nonce.");
    });

    it("should throw when Apple JWT verification fails", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ id_token: "apple-token" }), {
          status: 200,
        }),
      );
      jwtVerifyMock.mockRejectedValue(new Error("invalid signature"));

      await expect(
        exchangeCodeForProfile("apple", {
          code: "auth-code",
          nonce: "nonce-apple",
        }),
      ).rejects.toThrow("invalid signature");
    });

    it("should throw when Apple nonce is missing from token payload", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ id_token: "apple-token" }), {
          status: 200,
        }),
      );
      jwtVerifyMock.mockResolvedValue({
        payload: {
          ...applePayload,
          nonce: undefined,
        },
      });

      await expect(
        exchangeCodeForProfile("apple", {
          code: "auth-code",
          nonce: "nonce-apple",
        }),
      ).rejects.toThrow("Invalid Apple nonce.");
    });

    it("should throw when Apple subject claim is missing", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ id_token: "apple-token" }), {
          status: 200,
        }),
      );
      jwtVerifyMock.mockResolvedValue({
        payload: {
          ...applePayload,
          sub: undefined,
        },
      });

      await expect(
        exchangeCodeForProfile("apple", {
          code: "auth-code",
          nonce: "nonce-apple",
        }),
      ).rejects.toThrow("Missing Apple subject claim.");
    });

    it("should throw when Apple email claim is missing", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ id_token: "apple-token" }), {
          status: 200,
        }),
      );
      jwtVerifyMock.mockResolvedValue({
        payload: {
          ...applePayload,
          email: undefined,
        },
      });

      await expect(
        exchangeCodeForProfile("apple", {
          code: "auth-code",
          nonce: "nonce-apple",
        }),
      ).rejects.toThrow("Missing Apple email claim.");
    });

    it("should ignore malformed Apple userForm JSON", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ id_token: "apple-token" }), {
          status: 200,
        }),
      );
      jwtVerifyMock.mockResolvedValue({ payload: applePayload });

      const profile = await exchangeCodeForProfile("apple", {
        code: "auth-code",
        nonce: "nonce-apple",
        userForm: "{not-json",
      });

      expect(profile.firstName).toBe("");
      expect(profile.lastName).toBe("");
      expect(profile.email).toBe("apple@example.com");
    });

    it("should mark Apple email as unverified when claim is false", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ id_token: "apple-token" }), {
          status: 200,
        }),
      );
      jwtVerifyMock.mockResolvedValue({
        payload: {
          ...applePayload,
          email_verified: "false",
        },
      });

      const profile = await exchangeCodeForProfile("apple", {
        code: "auth-code",
        nonce: "nonce-apple",
      });

      expect(profile.emailVerified).toBe(false);
    });
  });

  describe("createPkce", () => {
    it("should derive deterministic verifier/challenge values from crypto primitives", async () => {
      const randomBytes = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
      const digestBytes = Uint8Array.from({ length: 32 }, (_, index) => 255 - index);

      const randomValuesMock = vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
        if (array instanceof Uint8Array) {
          array.set(randomBytes);
        }
        return array;
      });

      const digestMock = vi
        .spyOn(crypto.subtle, "digest")
        .mockImplementation(async (_algorithm, data) => {
          const input =
            data instanceof ArrayBuffer
              ? new Uint8Array(data)
              : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

          const expectedVerifier = Buffer.from(randomBytes).toString("base64url");
          expect(new TextDecoder().decode(input)).toBe(expectedVerifier);

          return digestBytes.buffer;
        });

      const pkce = await createPKCE();

      expect(randomValuesMock).toHaveBeenCalledOnce();
      expect(digestMock).toHaveBeenCalledWith("SHA-256", expect.any(Uint8Array));
      expect(pkce).toEqual({
        method: "S256",
        verifier: Buffer.from(randomBytes).toString("base64url"),
        challenge: Buffer.from(digestBytes).toString("base64url"),
      });
    });

    it("should return url-safe, fixed-length PKCE parts", async () => {
      vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
        if (array instanceof Uint8Array) {
          array.fill(7);
        }
        return array;
      });

      const pkce = await createPKCE();

      expect(pkce.method).toBe("S256");
      expect(pkce.verifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(pkce.challenge).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(pkce.verifier).not.toContain("=");
      expect(pkce.challenge).not.toContain("=");
      expect(pkce.verifier.length).toBe(43);
      expect(pkce.challenge.length).toBe(43);
    });
  });
});
