import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { exportJWK, generateKeyPair, importJWK, jwtVerify } from "jose";

import { randomToken, signJWT } from "./crypto";

let kid: string;
let publicJwk: object;
let privateJwk: object;

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    modulusLength: 2048,
    extractable: true,
  });
  kid = crypto.randomUUID();
  privateJwk = { ...(await exportJWK(privateKey)), alg: "RS256" };
  publicJwk = { ...(await exportJWK(publicKey)), alg: "RS256" };
});

beforeEach(() => {
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.cloud");
  vi.stubEnv(
    "JWKS",
    JSON.stringify({
      kid,
      private: privateJwk,
      public: { keys: [publicJwk] },
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("randomToken", () => {
  it("should return a 64-character hex string", () => {
    const token = randomToken();

    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should produce unique tokens on each call", () => {
    const tokens = Array.from({ length: 100 }, () => randomToken());

    expect(new Set(tokens).size).toBe(100);
  });
});

describe("signJWT", () => {
  it("should return a three-part JWT string", async () => {
    const jwt = await signJWT("user_1" as any);

    expect(jwt.split(".")).toHaveLength(3);
  });

  it("should include correct claims in the payload", async () => {
    const jwt = await signJWT("user_abcd" as any);

    const { payload } = await jwtVerify(jwt, await importJWK(publicJwk, "RS256"));

    expect(payload.sub).toBe("user_abcd");
    expect(payload.aud).toBe("convex");
    expect(payload.iss).toBe("https://test.convex.cloud");
  });

  it("should set iat and exp with a 15-minute window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);

    const jwt = await signJWT("user_1" as any);

    const { payload } = await jwtVerify(jwt, await importJWK(publicJwk, "RS256"));
    expect(payload.iat).toBe(1_700_000_000);
    expect(payload.exp).toBe(1_700_000_900);
    vi.useRealTimers();
  });

  it("should produce a signature verifiable with the public key", async () => {
    const jwt = await signJWT("user_test" as any);

    const { payload } = await jwtVerify(jwt, await importJWK(publicJwk, "RS256"));

    expect(payload.sub).toBe("user_test");
  });
});
