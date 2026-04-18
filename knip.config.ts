import type { KnipConfig } from "knip";

export default {
  workspaces: {
    ".": {
      entry: ["vite.config.ts"],
    },
    "apps/dashboard": {
      entry: ["src/**/*.test.ts"],
    },
    "packages/better-auth": {
      entry: ["src/**/*.test.ts"],
    },
    "packages/convex": {
      entry: ["src/**"],
    },
    "packages/crpc": {
      ignore: ["src/**/*.template.ts"],
    },
  },
  ignoreUnresolved: ["\\$env/dynamic/public"],
} satisfies KnipConfig;
