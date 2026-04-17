import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("dotenv", () => ({
  config: () => ({ parsed: {} }),
}));

describe("getEnv", () => {
  it("Throws when required a .env variable is missing.", async () => {
    delete process.env.DASHBOARD_URL;
    delete process.env.MARKETING_URL;

    vi.resetModules();
    const { getEnv } = await import(".");

    expect(() => getEnv()).toThrow();
  });
});
