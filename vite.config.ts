import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: ["packages/convex/src/_generated/**"],
    sortImports: true,
    sortPackageJson: { sortScripts: true },
  },
  lint: {
    ignorePatterns: ["packages/convex/src/_generated/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  staged: {
    "*": "vp check --fix",
  },
});
