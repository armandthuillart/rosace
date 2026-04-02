import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: { "*": "vp check --fix" },
  fmt: {
    sortImports: true,
    sortTailwindcss: true,
    sortPackageJson: { sortScripts: true },
  },
});
