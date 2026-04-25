import type { KnipConfig } from "knip";

export default {
  workspaces: {
    ".": {
      entry: ["vite.config.ts"],
    },
    "apps/dashboard": {
      entry: ["src/**/*.test.ts"],
    },
    "packages/convex": {
      entry: ["src/**"],
    },
  },
  ignoreUnresolved: ["\\$env/dynamic/public"],
} satisfies KnipConfig;
