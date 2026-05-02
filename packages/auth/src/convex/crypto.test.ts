import { beforeAll, describe, expect, it, vi } from "vite-plus/test";

type CryptoPayload =
  | { type: "password:hash"; password: string }
  | { type: "password:verify"; password: string; hash: string };

type CryptoHandler = (
  ctx: unknown,
  args: {
    payload: CryptoPayload;
  },
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
  async function hashPassword(password: string): Promise<string> {
    const result = await cryptoHandler({}, { payload: { type: "password:hash", password } });

    if (!("hash" in result)) {
      throw new Error("Expected hash result");
    }

    return result.hash;
  }

  async function verifyPassword(password: string, hash: string): Promise<boolean> {
    const result = await cryptoHandler(
      {},
      {
        payload: { type: "password:verify", password, hash },
      },
    );

    if (!("ok" in result)) {
      throw new Error("Expected verify result");
    }

    return result.ok;
  }

  it("should hash then verify the same password", async () => {
    const hash = await hashPassword("s3cr3t");

    expect(hash.startsWith("argon2id$")).toBe(true);
    await expect(verifyPassword("s3cr3t", hash)).resolves.toBe(true);
  });

  it("should reject invalid verification attempts", async () => {
    const hash = await hashPassword("correct-password");

    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
    await expect(verifyPassword("irrelevant", "not-a-valid-hash")).resolves.toBe(false);
  });
});
