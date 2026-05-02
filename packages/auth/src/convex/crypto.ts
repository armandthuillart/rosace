import { argon2id } from "@noble/hashes/argon2.js";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils.js";
import { internalActionGeneric } from "convex/server";
import { v } from "convex/values";

const ARGON2_MEMORY_COST_KIB = 19_456;
const ARGON2_TIME_COST = 2;
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_BYTES = 32;
const ARGON2_SALT_BYTES = 16;

function hashPassword(password: string): string {
  const salt = randomBytes(ARGON2_SALT_BYTES);
  const derived = argon2id(password, salt, {
    m: ARGON2_MEMORY_COST_KIB,
    t: ARGON2_TIME_COST,
    p: ARGON2_PARALLELISM,
    dkLen: ARGON2_HASH_BYTES,
  });

  return [
    "argon2id",
    ARGON2_MEMORY_COST_KIB,
    ARGON2_TIME_COST,
    ARGON2_PARALLELISM,
    bytesToHex(salt),
    bytesToHex(derived),
  ].join("$");
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "argon2id") return false;

  const m = Number(parts[1]);
  const t = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(m) || !Number.isFinite(t) || !Number.isFinite(p))
    return false;

  const salt = hexToBytes(parts[4]);
  const expected = hexToBytes(parts[5]);
  const actual = argon2id(password, salt, { m, t, p, dkLen: expected.length });

  if (actual.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

const internalAction = internalActionGeneric({
  args: {
    payload: v.union(
      v.object({
        type: v.literal("password:hash"),
        password: v.string(),
      }),
      v.object({
        type: v.literal("password:verify"),
        password: v.string(),
        hash: v.string(),
      }),
    ),
  },
  handler: async (_ctx, { payload }) => {
    switch (payload.type) {
      case "password:hash": {
        return { hash: hashPassword(payload.password) };
      }
      case "password:verify": {
        try {
          return { ok: verifyPassword(payload.password, payload.hash) };
        } catch {
          return { ok: false };
        }
      }
      default: {
        const _never: never = payload;
        throw new Error(
          `Unsupported password action op: ${JSON.stringify(_never)}`,
        );
      }
    }
  },
});

export { internalAction };
