import { describe, expect, it, vi } from "vite-plus/test";

import { clear, list, read } from "./cookies";

describe("list", () => {
  it("should return handoff cookie string", () => {
    const result = list("handoff", { code: "abc123" });

    expect(result).toBe(
      "session:handoff=abc123; Path=/auth/; HttpOnly; Secure; SameSite=Lax; Max-Age=60",
    );
  });

  it("should return session cookie string with computed max-age", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000_000);

    const result = list("session", {
      sessionToken: "tok-abc",
      expiresAt: 1_000_002_000_000,
    });

    expect(result).toBe(
      "session:token=tok-abc; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2000",
    );
    vi.useRealTimers();
  });

  it("should clamp max-age to minimum of 1", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000_000);

    const result = list("session", {
      sessionToken: "tok",
      expiresAt: 999_999_000_000,
    });

    expect(result).toContain("Max-Age=1");
    vi.useRealTimers();
  });
});

describe("clear", () => {
  it("should return handoff clearing cookie", () => {
    const result = clear("handoff");

    expect(result).toBe("session:handoff=; Path=/auth/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  });

  it("should return session clearing cookie", () => {
    const result = clear("session");

    expect(result).toBe("session:token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  });
});

describe("read", () => {
  it("should parse cookie header into key-value pairs", () => {
    const request = new Request("https://example.com", {
      headers: { cookie: "foo=bar; baz=qux" },
    });

    const result = read(request);

    expect(result).toEqual({ foo: "bar", baz: "qux" });
  });

  it("should URL-decode cookie values", () => {
    const request = new Request("https://example.com", {
      headers: { cookie: "key=hello%20world" },
    });

    const result = read(request);

    expect(result).toEqual({ key: "hello world" });
  });

  it("should use only the first = as key-value delimiter", () => {
    const request = new Request("https://example.com", {
      headers: { cookie: "key=val=ue" },
    });

    const result = read(request);

    expect(result).toEqual({ key: "val=ue" });
  });

  it("should return empty object for missing cookie header", () => {
    const request = new Request("https://example.com");

    const result = read(request);

    expect(result).toEqual({});
  });

  it("should skip segments without a = sign", () => {
    const request = new Request("https://example.com", {
      headers: { cookie: "valid=ok; justastring" },
    });

    const result = read(request);

    expect(result).toEqual({ valid: "ok" });
  });

  it("should skip segments with an empty key", () => {
    const request = new Request("https://example.com", {
      headers: { cookie: "valid=ok; =valueless" },
    });

    const result = read(request);

    expect(result).toEqual({ valid: "ok" });
  });

  it("should skip values with invalid URL encoding", () => {
    const request = new Request("https://example.com", {
      headers: { cookie: "good=ok; bad=%GGinvalid" },
    });

    const result = read(request);

    expect(result).toEqual({ good: "ok" });
  });
});
