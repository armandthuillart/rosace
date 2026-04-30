import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: ["**/_generated/**"],
    sortImports: true,
    sortPackageJson: { sortScripts: true },
  },
  lint: {
    ignorePatterns: ["**/_generated/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  staged: {
    "*": "vp check --fix",
  },
});
