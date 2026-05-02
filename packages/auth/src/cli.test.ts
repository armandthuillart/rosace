import { describe, expect, it, vi } from "vite-plus/test";

const {
  execFileSyncMock,
  exportJWKMock,
  generateKeyPairMock,
  randomBytesMock,
  randomUUIDMock,
} = vi.hoisted(() => ({
  execFileSyncMock: vi.fn(),
  exportJWKMock: vi.fn(),
  generateKeyPairMock: vi.fn(),
  randomBytesMock: vi.fn(),
  randomUUIDMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFileSync: execFileSyncMock,
}));

vi.mock("node:crypto", () => ({
  randomBytes: randomBytesMock,
  randomUUID: randomUUIDMock,
}));

vi.mock("jose", () => ({
  exportJWK: exportJWKMock,
  generateKeyPair: generateKeyPairMock,
}));

import { createJwks, run } from "./cli";

describe("auth cli", () => {
  it("should be idempotent and initialize only missing secrets", async () => {
    execFileSyncMock.mockReset();
    randomBytesMock.mockReset();
    generateKeyPairMock.mockReset();
    exportJWKMock.mockReset();
    randomUUIDMock.mockReset();

    execFileSyncMock
      .mockReturnValueOnce("already-present")
      .mockReturnValueOnce("")
      .mockReturnValue("");

    randomBytesMock.mockReturnValue(Uint8Array.from({ length: 32 }, () => 1));
    randomUUIDMock.mockReturnValue("kid-fixed");
    generateKeyPairMock.mockResolvedValue({
      publicKey: "pub",
      privateKey: "priv",
    });

    exportJWKMock.mockImplementation(async (key: unknown) =>
      key === "pub"
        ? { kty: "RSA", n: "pub-n", e: "AQAB" }
        : { kty: "RSA", d: "priv-d" },
    );

    await run(["node", "auth", "set"]);

    expect(execFileSyncMock).toHaveBeenCalledWith(
      "vp",
      [
        "exec",
        "--filter",
        "./packages/convex",
        "--",
        "convex",
        "env",
        "get",
        "AUTH_SECRET",
      ],
      expect.objectContaining({ encoding: "utf8" }),
    );

    expect(execFileSyncMock).toHaveBeenCalledWith(
      "vp",
      [
        "exec",
        "--filter",
        "./packages/convex",
        "--",
        "convex",
        "env",
        "get",
        "PUBLIC_JWKS",
      ],
      expect.objectContaining({ encoding: "utf8" }),
    );

    const setCalls = execFileSyncMock.mock.calls.filter((call) => {
      const args = call[1] as string[] | undefined;
      return args?.[5] === "env" && args?.[6] === "set";
    });

    expect(setCalls).toHaveLength(1);
    expect(setCalls[0]?.[1]).toEqual(expect.arrayContaining(["PUBLIC_JWKS"]));
    expect(setCalls[0]?.[1]).not.toEqual(
      expect.arrayContaining(["AUTH_SECRET"]),
    );
  });

  it("should overwrite both secrets and honor --prod scope", async () => {
    execFileSyncMock.mockReset();

    await run(["node", "auth", "rotate", "--prod"], {
      createJwks: vi.fn(async () => '{"kid":"prod"}'),
      getEnv: vi.fn(() => ""),
      randomSecret: vi.fn(() => "secret-prod"),
      setEnv: vi.fn((name: string, value: string, prod = false) => {
        execFileSyncMock("vp", [
          "exec",
          "convex",
          "env",
          "set",
          ...(prod ? ["--prod"] : []),
          "--",
          name,
          value,
        ]);
      }),
    });

    const setCalls = execFileSyncMock.mock.calls.map(
      (call) => (call[1] as string[] | undefined) ?? [],
    );

    expect(setCalls).toContainEqual([
      "exec",
      "convex",
      "env",
      "set",
      "--prod",
      "--",
      "AUTH_SECRET",
      "secret-prod",
    ]);

    expect(setCalls).toContainEqual([
      "exec",
      "convex",
      "env",
      "set",
      "--prod",
      "--",
      "PUBLIC_JWKS",
      '{"kid":"prod"}',
    ]);
  });

  it("should keep consistent kid across public and private keys", async () => {
    randomUUIDMock.mockReset();
    generateKeyPairMock.mockReset();
    exportJWKMock.mockReset();

    randomUUIDMock.mockReturnValue("kid-123");
    generateKeyPairMock.mockResolvedValue({
      publicKey: "public",
      privateKey: "private",
    });

    exportJWKMock.mockImplementation(async (key: unknown) =>
      key === "public"
        ? { kty: "RSA", n: "n", e: "AQAB" }
        : { kty: "RSA", d: "d" },
    );

    const raw = await createJwks();
    const jwks = JSON.parse(raw) as {
      kid: string;
      privateJwk: { kid: string; alg: string; use: string };
      publicJwks: { keys: Array<{ kid: string; alg: string; use: string }> };
    };

    expect(jwks.kid).toBe("kid-123");
    expect(jwks.publicJwks.keys).toHaveLength(1);
    expect(jwks.publicJwks.keys[0]).toEqual(
      expect.objectContaining({ kid: "kid-123", alg: "RS256", use: "sig" }),
    );
    expect(jwks.privateJwk).toEqual(
      expect.objectContaining({ kid: "kid-123", alg: "RS256", use: "sig" }),
    );
  });
});
