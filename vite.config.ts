import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: [],
  },
  staged: {
    "*": "vp check --fix",
  },
});
