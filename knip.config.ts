import type { KnipConfig } from "knip";

export default {
  ignore: ["**/*.test.ts"],
  ignoreUnresolved: ["\\$env/dynamic/private", "\\$env/dynamic/public"],
  svelte: {
    config: ["svelte.config.ts"],
  },
  sveltekit: {
    config: ["svelte.config.ts"],
  },
  workspaces: {
    "packages/convex": {
      entry: ["src/**"],
    },
  },
} satisfies KnipConfig;
