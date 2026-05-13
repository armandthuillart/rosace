import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    ignorePatterns: ['**/.agents/**', '**/*generated/**'],
    singleQuote: true,
    sortImports: true,
    sortPackageJson: { sortScripts: true },
  },
  lint: {
    ignorePatterns: ['**/.agents/**', '**/*generated/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  staged: {
    '*': 'vp check --fix',
  },
});
