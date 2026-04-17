import type { KnipConfig } from "knip";

const knipConfig: KnipConfig = {
  workspaces: {
    ".": {
      entry: ["vite.config.ts"],
    },
    "apps/dashboard": {
      entry: ["src/**/*.test.ts"],
    },
    "packages/better-auth": {
      entry: ["vite.config.ts", "src/**/*.test.ts"],
    },
    "packages/convex": {
      entry: ["src/**"],
    },
    "packages/crpc": {
      ignore: ["src/**/*.template.ts"],
    },
  },
  ignore: ["packages/convex/src/_generated/**"],
  ignoreDependencies: ["tailwindcss"],
  ignoreUnresolved: ["\\$env/dynamic/public"],
};

export default knipConfig;
