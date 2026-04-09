import type { KnipConfig } from "knip";

const config: KnipConfig = {
  workspaces: {
    "packages/convex": {
      entry: ["src/**/*.{ts,tsx}"],
      ignore: ["src/_generated/**"],
    },
    "packages/crpc": {
      ignore: ["src/cli/generated/**"],
    },
  },
  ignoreDependencies: ["vite"],
};

export default config;
