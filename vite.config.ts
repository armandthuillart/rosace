import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    sortImports: true,
    sortTailwindcss: true,
    sortPackageJson: { sortScripts: true },
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  staged: {
    "*": "vp check --fix",
  },
});
