import { describe, expect, it, vi } from "vite-plus/test";

const { StripeMock } = vi.hoisted(() => ({
  StripeMock: vi.fn().mockImplementation(() => ({ __type: "stripe-client" })),
}));

vi.mock("stripe", () => ({
  default: StripeMock,
}));

vi.mock("./env", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_123",
  },
}));

describe("payments module", () => {
  it("should initialize Stripe with the configured secret key", async () => {
    vi.resetModules();
    await import("./payments");

    expect(StripeMock).toHaveBeenCalledTimes(1);
    expect(StripeMock).toHaveBeenCalledWith("sk_test_123");
  });

  it("should only initialize once per module cache lifecycle", async () => {
    vi.resetModules();
    await import("./payments");
    await import("./payments");

    expect(StripeMock).toHaveBeenCalledTimes(1);
  });
});
