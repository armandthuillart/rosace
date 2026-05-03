import type { GenericActionCtx } from "convex/server";
import type { GenericDataModel } from "convex/server";
import { beforeAll, describe, expect, it, vi } from "vite-plus/test";

type CryptoPayload =
  | { type: "password:hash"; password: string }
  | { type: "password:verify"; password: string; hash: string };

type CryptoHandler = (
  ctx: GenericActionCtx<GenericDataModel>,
  args: { payload: CryptoPayload },
) => Promise<{ hash: string } | { ok: boolean }>;

type CryptoActionDefinition = {
  handler: CryptoHandler;
};

const { internalActionGenericMock } = vi.hoisted(() => ({
  internalActionGenericMock: vi.fn(
    (definition: CryptoActionDefinition): CryptoActionDefinition => definition,
  ),
}));

vi.mock("convex/server", () => ({
  internalActionGeneric: internalActionGenericMock,
}));

let cryptoHandler: CryptoHandler;

beforeAll(async () => {
  await import("./crypto");

  const definition = internalActionGenericMock.mock.calls.at(0)?.[0];

  if (!definition) {
    throw new Error("Expected crypto internalActionGeneric registration");
  }

  cryptoHandler = definition.handler;
});

describe("crypto", () => {
  it("should hash a password with argon2id prefix", async () => {
    const result = await cryptoHandler({} as GenericActionCtx<GenericDataModel>, {
      payload: { type: "password:hash", password: "s3cr3t" },
    });

    if (!("hash" in result)) {
      throw new Error("Expected hash result");
    }

    expect(result.hash.startsWith("argon2id$")).toBe(true);
  });

  it("should verify a password against its hash", async () => {
    const hashResult = await cryptoHandler({} as GenericActionCtx<GenericDataModel>, {
      payload: { type: "password:hash", password: "s3cr3t" },
    });

    if (!("hash" in hashResult)) {
      throw new Error("Expected hash result");
    }

    const verifyResult = await cryptoHandler({} as GenericActionCtx<GenericDataModel>, {
      payload: {
        type: "password:verify",
        password: "s3cr3t",
        hash: hashResult.hash,
      },
    });

    if (!("ok" in verifyResult)) {
      throw new Error("Expected verify result");
    }

    expect(verifyResult.ok).toBe(true);
  });

  it("should reject verification with wrong password", async () => {
    const hashResult = await cryptoHandler({} as GenericActionCtx<GenericDataModel>, {
      payload: { type: "password:hash", password: "correct-password" },
    });

    if (!("hash" in hashResult)) {
      throw new Error("Expected hash result");
    }

    const verifyResult = await cryptoHandler({} as GenericActionCtx<GenericDataModel>, {
      payload: {
        type: "password:verify",
        password: "wrong-password",
        hash: hashResult.hash,
      },
    });

    if (!("ok" in verifyResult)) {
      throw new Error("Expected verify result");
    }

    expect(verifyResult.ok).toBe(false);
  });

  it("should reject verification with invalid hash", async () => {
    const result = await cryptoHandler({} as GenericActionCtx<GenericDataModel>, {
      payload: {
        type: "password:verify",
        password: "irrelevant",
        hash: "not-a-valid-hash",
      },
    });

    if (!("ok" in result)) {
      throw new Error("Expected verify result");
    }

    expect(result.ok).toBe(false);
  });
});
