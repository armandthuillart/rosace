import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: ["**/.agents/**", "**/*generated/**"],
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
