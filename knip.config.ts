import type { KnipConfig } from "knip";

export default {
  ignoreUnresolved: ["\\$app/environment", "\\$env/dynamic/private", "\\$env/dynamic/public"],
  svelte: {
    config: ["svelte.config.ts"],
  },
  sveltekit: {
    config: ["svelte.config.ts"],
  },
  workspaces: {
    "packages/auth": {
      entry: ["src/**/*.test.ts"],
    },
    "packages/convex": {
      entry: ["src/**"],
    },
  },
} satisfies KnipConfig;
