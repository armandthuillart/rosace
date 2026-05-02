import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: ["**/.agents/**", "**/*generated/**"],
    printWidth: 80,
    sortImports: true,
    sortPackageJson: { sortScripts: true },
  },
  lint: {
    ignorePatterns: ["**/.agents/**", "**/*generated/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  staged: {
    "*": "vp check --fix",
  },
});
